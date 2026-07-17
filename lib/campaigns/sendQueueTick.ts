import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { renderMergeTags } from "@/lib/campaigns/mergeTags";

const DEFAULT_BATCH_SIZE = 20;
/** How far out to reschedule a contact after a send failure, so a tick doesn't tight-loop on it. */
const RETRY_DELAY_MS = 60 * 60 * 1000;

type TickResult = { processed: number; sent: number; failed: number; skipped: number };

/**
 * Stand-in for the "send-queue tick" background job (no cron infra yet — this is
 * invoked by an admin hitting a manual endpoint). Sends real email via each
 * campaign's connected SMTP mailbox (email_provider_accounts always has SMTP
 * creds, so this doesn't need Gmail OAuth token refresh to run unattended).
 *
 * Phase 1 simplification: outbound messages are created with tracking disabled
 * (no open/click pixel wiring yet), so campaign_daily_stats.opens/clicks stay 0
 * until that's layered in.
 */
export async function runCampaignSendQueueTick(companyId: string, batchSize = DEFAULT_BATCH_SIZE): Promise<TickResult> {
  const result: TickResult = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  const activeCampaigns = await prisma.campaign.findMany({
    where: { company_id: companyId, status: "active" },
    include: { email_provider_accounts: true },
  });

  for (const campaign of activeCampaigns) {
    if (result.processed >= batchSize) break;

    const sentToday = await prisma.emailOutboundMessage.count({
      where: {
        campaign_id: campaign.id,
        created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    if (sentToday >= campaign.daily_send_limit) continue;

    const remainingBudget = Math.min(batchSize - result.processed, campaign.daily_send_limit - sentToday);
    if (remainingBudget <= 0) continue;

    const due = await prisma.campaignContact.findMany({
      where: { campaign_id: campaign.id, queue_status: "queued", next_send_at: { lte: new Date() } },
      orderBy: { next_send_at: "asc" },
      take: remainingBudget,
    });

    const steps = await prisma.campaignStep.findMany({
      where: { campaign_id: campaign.id },
      orderBy: { step_order: "asc" },
      include: { email_templates: true },
    });
    if (steps.length === 0) continue;

    for (const contact of due) {
      result.processed += 1;

      const blocked = await prisma.emailBlockedSender.findFirst({
        where: {
          user_id: campaign.email_provider_accounts.user_id,
          email: contact.contact_email,
          soft_deleted_at: null,
        },
        select: { id: true },
      });
      if (blocked) {
        await prisma.campaignContact.update({
          where: { id: contact.id },
          data: { queue_status: "skipped", skip_reason: "dnc" },
        });
        result.skipped += 1;
        continue;
      }

      const currentIndex = contact.current_step_id ? steps.findIndex((s) => s.id === contact.current_step_id) : -1;
      const stepToSend = steps[currentIndex + 1];
      if (!stepToSend) {
        // Sequence already exhausted (shouldn't normally be reached — completed contacts aren't 'queued').
        await prisma.campaignContact.update({
          where: { id: contact.id },
          data: { queue_status: "completed", completed_at: new Date() },
        });
        continue;
      }

      const subjectTemplate = stepToSend.subject_override || stepToSend.email_templates?.subject || "";
      const bodyHtmlTemplate = stepToSend.body_html_override || stepToSend.email_templates?.body_html || "";
      const bodyTextTemplate = stepToSend.body_text_override || stepToSend.email_templates?.body_text || "";
      const subject = renderMergeTags(subjectTemplate, contact) || "(No Subject)";
      const bodyHtml = renderMergeTags(bodyHtmlTemplate, contact);
      const bodyText = renderMergeTags(bodyTextTemplate, contact) || bodyHtml.replace(/<[^>]+>/g, " ").trim();

      const account = campaign.email_provider_accounts;
      let sendError: string | null = null;
      try {
        const transporter = nodemailer.createTransport({
          host: account.smtp_host,
          port: account.smtp_port,
          secure: account.smtp_secure,
          auth: { user: account.smtp_username, pass: decrypt(account.smtp_password_enc) },
        });
        await transporter.sendMail({
          from: account.account_email,
          to: contact.contact_email,
          subject,
          text: bodyText,
          html: bodyHtml || undefined,
        });
      } catch (error) {
        sendError = error instanceof Error ? error.message : "SMTP send failed.";
      }

      if (sendError) {
        await prisma.campaignStepSend.upsert({
          where: { campaign_contact_id_step_id: { campaign_contact_id: contact.id, step_id: stepToSend.id } },
          create: {
            campaign_contact_id: contact.id,
            step_id: stepToSend.id,
            status: "failed",
            scheduled_at: contact.next_send_at ?? new Date(),
            attempted_at: new Date(),
            failed_at: new Date(),
            fail_reason: sendError,
            retry_count: 1,
          },
          update: {
            status: "failed",
            attempted_at: new Date(),
            failed_at: new Date(),
            fail_reason: sendError,
            retry_count: { increment: 1 },
          },
        });
        await prisma.campaignContact.update({
          where: { id: contact.id },
          data: { next_send_at: new Date(Date.now() + RETRY_DELAY_MS) },
        });
        result.failed += 1;
        continue;
      }

      const sentAt = new Date();
      const outbound = await prisma.emailOutboundMessage.create({
        data: {
          user_id: account.user_id,
          account_id: account.id,
          campaign_id: campaign.id,
          campaign_contact_id: contact.id,
          step_id: stepToSend.id,
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          tracking_enabled: false,
        },
      });

      await prisma.campaignStepSend.upsert({
        where: { campaign_contact_id_step_id: { campaign_contact_id: contact.id, step_id: stepToSend.id } },
        create: {
          campaign_contact_id: contact.id,
          step_id: stepToSend.id,
          status: "sent",
          scheduled_at: contact.next_send_at ?? sentAt,
          rendered_subject: subject,
          rendered_body_html: bodyHtml,
          rendered_body_text: bodyText,
          outbound_message_id: outbound.id,
          attempted_at: sentAt,
          sent_at: sentAt,
        },
        update: {
          status: "sent",
          rendered_subject: subject,
          rendered_body_html: bodyHtml,
          rendered_body_text: bodyText,
          outbound_message_id: outbound.id,
          attempted_at: sentAt,
          sent_at: sentAt,
          failed_at: null,
          fail_reason: null,
        },
      });

      const nextStep = steps[currentIndex + 2];
      if (nextStep) {
        await prisma.campaignContact.update({
          where: { id: contact.id },
          data: {
            current_step_id: stepToSend.id,
            last_sent_at: sentAt,
            next_send_at: new Date(sentAt.getTime() + nextStep.delay_days * 24 * 60 * 60 * 1000),
          },
        });
      } else {
        const isStillNoResponse = contact.lead_status === "no_response";
        await prisma.campaignContact.update({
          where: { id: contact.id },
          data: {
            current_step_id: stepToSend.id,
            last_sent_at: sentAt,
            next_send_at: null,
            queue_status: "completed",
            completed_at: sentAt,
            lead_status: isStillNoResponse ? "not_interested" : contact.lead_status,
          },
        });
        if (isStillNoResponse) {
          await prisma.leadStatusEvent.create({
            data: {
              campaign_contact_id: contact.id,
              from_status: "no_response",
              to_status: "not_interested",
              changed_by_rule: "auto:sequence_exhausted",
            },
          });
        }
      }

      await prisma.campaignDailyStat.upsert({
        where: { campaign_id_date: { campaign_id: campaign.id, date: new Date(new Date().setHours(0, 0, 0, 0)) } },
        create: { campaign_id: campaign.id, date: new Date(new Date().setHours(0, 0, 0, 0)), emails_sent: 1 },
        update: { emails_sent: { increment: 1 } },
      });

      result.sent += 1;
    }
  }

  return result;
}
