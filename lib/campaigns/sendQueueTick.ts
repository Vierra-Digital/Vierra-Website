import { prisma } from "@/lib/prisma";
import type { CampaignContact, Prisma } from "@prisma/client";
import { createSmtpTransport } from "@/lib/email/smtp";
import { renderMergeTags } from "@/lib/campaigns/mergeTags";

const DEFAULT_BATCH_SIZE = 20;
/** How far out to reschedule a contact after a send failure, so a tick doesn't tight-loop on it. */
const RETRY_DELAY_MS = 60 * 60 * 1000;
/** How many send attempts for one step before we give up and stop rescheduling the contact. */
const MAX_SEND_ATTEMPTS = 3;
/**
 * Cadence of the cron dispatcher (campaigns/send-queue/dispatch runs every 5 min). Used to convert
 * a per-campaign send gap into a per-tick allowance so pacing averages out to the configured rate
 * across ticks — a serverless tick can't sleep between sends, so pacing is enforced ACROSS ticks.
 */
const TICK_INTERVAL_SECONDS = 300;

type TickResult = { processed: number; sent: number; failed: number; skipped: number };
type ContactOutcome = "skipped" | "completed" | "failed" | "sent";
type ActiveCampaign = Prisma.CampaignGetPayload<{ include: { email_provider_accounts: true } }>;
type SequenceStep = Prisma.CampaignStepGetPayload<{ include: { email_templates: true } }>;

/**
 * Process one queued campaign contact: DNC-skip → resolve the next step → send via SMTP →
 * record the step-send + advance/complete the sequence → bump the daily stat. Returns the
 * outcome so the caller can tally counters. (Extracted from runCampaignSendQueueTick to keep
 * that function an orchestrator; behavior is unchanged.)
 */
async function processContact(
  campaign: ActiveCampaign,
  contact: CampaignContact,
  steps: SequenceStep[]
): Promise<ContactOutcome> {
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
    return "skipped";
  }

  const currentIndex = contact.current_step_id ? steps.findIndex((s) => s.id === contact.current_step_id) : -1;
  if (contact.current_step_id && currentIndex === -1) {
    // The step this contact was on was deleted. Complete the sequence rather than silently
    // restarting it from step 1 (which would re-send the whole sequence to this contact).
    await prisma.campaignContact.update({
      where: { id: contact.id },
      data: { queue_status: "completed", completed_at: new Date() },
    });
    return "completed";
  }
  const stepToSend = steps[currentIndex + 1];
  if (!stepToSend) {
    // Sequence already exhausted (shouldn't normally be reached — completed contacts aren't 'queued').
    await prisma.campaignContact.update({
      where: { id: contact.id },
      data: { queue_status: "completed", completed_at: new Date() },
    });
    return "completed";
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
    const transporter = createSmtpTransport(account);
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
    const stepSend = await prisma.campaignStepSend.upsert({
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
    // Give up after MAX_SEND_ATTEMPTS (e.g. a permanently bad address) instead of retrying
    // hourly forever and holding a budget slot. Otherwise return to the queue for a retry.
    const giveUp = stepSend.retry_count >= MAX_SEND_ATTEMPTS;
    await prisma.campaignContact.update({
      where: { id: contact.id },
      data: giveUp
        ? { queue_status: "failed", skip_reason: "send_failed", next_send_at: null }
        : { queue_status: "queued", next_send_at: new Date(Date.now() + RETRY_DELAY_MS) },
    });
    return "failed";
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
        queue_status: "queued",
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

  return "sent";
}

/**
 * Send-queue tick: advance every active campaign's due, queued contacts one step, respecting
 * each campaign's daily_send_limit and the batch size. Sends real email via the campaign's
 * connected SMTP mailbox. Invoked per-company by an admin (campaigns/send-queue/tick) and by
 * the cron dispatcher (campaigns/send-queue/dispatch → dispatch-campaign-queue, every 5 min).
 * Outbound messages are created with tracking disabled (no open/click pixel), so
 * campaign_daily_stats.opens/clicks stay 0 until that's layered in.
 */
export async function runCampaignSendQueueTick(companyId: string, batchSize = DEFAULT_BATCH_SIZE): Promise<TickResult> {
  const result: TickResult = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  const activeCampaigns = await prisma.campaign.findMany({
    where: { company_id: companyId, status: "active" },
    include: { email_provider_accounts: true },
  });

  for (const campaign of activeCampaigns) {
    if (result.processed >= batchSize) break;

    // Respect a future scheduled start. A campaign can be activated ahead of time (or have
    // contacts enrolled with an already-past next_send_at), but it must not send a single
    // message until its scheduled_start_at — otherwise the very next tick fires it immediately.
    if (campaign.scheduled_start_at && campaign.scheduled_start_at.getTime() > Date.now()) continue;

    const sentToday = await prisma.emailOutboundMessage.count({
      where: {
        campaign_id: campaign.id,
        created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    if (sentToday >= campaign.daily_send_limit) continue;

    // Per-send pacing: honor send_delay_seconds (+ up to send_jitter_seconds) instead of firing the
    // whole batch back-to-back. A serverless tick can't sleep, so pace across ticks — skip the
    // campaign until a jittered gap has elapsed since its last send, then allow only as many sends
    // as that gap divides into one tick interval, so the average send rate matches the configured
    // delay. The first-ever send is seeded at 1 to start the cadence cleanly.
    const gapSeconds =
      Math.max(1, campaign.send_delay_seconds) +
      Math.floor(Math.random() * (Math.max(0, campaign.send_jitter_seconds) + 1));
    const lastSend = await prisma.emailOutboundMessage.findFirst({
      where: { campaign_id: campaign.id },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    });
    let pacingAllowance: number;
    if (!lastSend) {
      pacingAllowance = 1;
    } else {
      const elapsedSeconds = (Date.now() - lastSend.created_at.getTime()) / 1000;
      if (elapsedSeconds < gapSeconds) continue;
      pacingAllowance = Math.max(1, Math.ceil(TICK_INTERVAL_SECONDS / gapSeconds));
    }

    const remainingBudget = Math.min(
      batchSize - result.processed,
      campaign.daily_send_limit - sentToday,
      pacingAllowance
    );
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
      // Atomically claim the contact (queued → sending) so an overlapping run — the cron
      // dispatcher and a manual tick, or a tick that overruns its 5-min interval — can't both
      // send the same step. processContact resets the status on every exit path.
      const claim = await prisma.campaignContact.updateMany({
        where: { id: contact.id, queue_status: "queued" },
        data: { queue_status: "sending" },
      });
      if (claim.count === 0) continue;
      result.processed += 1;
      try {
        const outcome = await processContact(campaign, contact, steps);
        if (outcome === "skipped") result.skipped += 1;
        else if (outcome === "failed") result.failed += 1;
        else if (outcome === "sent") result.sent += 1;
      } catch {
        // processContact threw AFTER the atomic claim (queued → sending) — e.g. a DB hiccup on the
        // post-send writes. The due query only re-selects "queued", so leaving it "sending" would
        // strand the contact forever. The email may already have gone out, so mark failed rather
        // than re-queue (which would risk a duplicate send).
        result.failed += 1;
        await prisma.campaignContact
          .update({
            where: { id: contact.id },
            data: { queue_status: "failed", skip_reason: "processing_error", next_send_at: null },
          })
          .catch(() => {});
      }
    }
  }

  return result;
}
