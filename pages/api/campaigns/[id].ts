import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { serializeCampaign } from "@/lib/api/campaigns";
import {
  createCampaign,
  setCampaignSequence,
  attachEmailAccount,
  updateCampaignStatus,
  smartleadConfigured,
  translateMergeTagsForSmartlead,
} from "@/lib/campaigns/smartlead/client";
import { brevoConfigured } from "@/lib/campaigns/brevo/client";
import { notifyDiscord, discordConfigured } from "@/lib/notify/discord";

function getId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
}

/** Which statuses a campaign may move to from its current status. Terminal states have no outgoing edges. */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: [],
  cancelled: [],
};

export default withAuth(async (req, res, session) => {
  const id = getId(req);
  if (!id) {
    res.status(400).json({ message: "Campaign id is required." });
    return;
  }

  const existing = await prisma.campaign.findFirst({
    where: { id, company_id: session.companyId },
    include: {
      email_provider_accounts: { select: { account_email: true, smartlead_email_account_id: true } },
      _count: { select: { campaign_steps: true, campaign_contacts: true } },
    },
  });
  if (!existing) {
    res.status(404).json({ message: "Campaign not found." });
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({ campaign: serializeCampaign(existing) });
    return;
  }

  if (req.method === "PATCH") {
    const nextStatus = asStr(req.body?.status);

    if (nextStatus) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(nextStatus)) {
        res.status(400).json({ message: `Cannot move campaign from '${existing.status}' to '${nextStatus}'.` });
        return;
      }
      if (nextStatus === "active" && existing.status === "draft") {
        const stepCount = await prisma.campaignStep.count({ where: { campaign_id: id } });
        if (stepCount === 0) {
          res.status(400).json({ message: "Add at least one sequence step before launching." });
          return;
        }
      }

      const data: any = { status: nextStatus };
      if (nextStatus === "active" && existing.status === "draft") data.started_at = new Date();
      if (nextStatus === "active" && existing.status === "paused") data.paused_at = null;
      if (nextStatus === "paused") data.paused_at = new Date();
      if (nextStatus === "completed" || nextStatus === "cancelled") data.completed_at = new Date();

      // Smartlead-provider campaigns: mirror the transition into Smartlead before applying it
      // locally, so local status never claims something Smartlead's side didn't actually do.
      // See .claude/schema_v2_campaigns_smartlead_integration.md Flow 1. NOTE: the exact
      // endpoints/payloads this calls (setCampaignSequence, attachEmailAccount,
      // updateCampaignStatus) are UNVERIFIED against Smartlead's real API — see client.ts.
      if (existing.send_provider === "smartlead") {
        if (nextStatus === "active") {
          if (!smartleadConfigured()) {
            res.status(400).json({ message: "Smartlead isn't configured (SMARTLEAD_API_KEY missing)." });
            return;
          }
          const smartleadEmailAccountId = existing.email_provider_accounts.smartlead_email_account_id;
          if (!smartleadEmailAccountId) {
            res.status(400).json({
              message:
                "This campaign's sending mailbox isn't connected to Smartlead yet. Connect it on the Smartlead side first (see design doc §9 — this may be a manual dashboard step), then record its Smartlead email account id before launching.",
            });
            return;
          }

          let smartleadCampaignId = existing.smartlead_campaign_id;
          if (!smartleadCampaignId) {
            const created = await createCampaign(existing.name);
            if (!created.ok) {
              res.status(502).json({ message: `Failed to create the Smartlead campaign: ${created.message}` });
              return;
            }
            smartleadCampaignId = String(created.data.id);

            const steps = await prisma.campaignStep.findMany({
              where: { campaign_id: id },
              orderBy: { step_order: "asc" },
              include: { email_templates: true },
            });
            const sequenceSteps = steps.map((step, index) => ({
              seq_number: index + 1,
              subject: translateMergeTagsForSmartlead(step.subject_override || step.email_templates?.subject || ""),
              email_body: translateMergeTagsForSmartlead(
                step.body_html_override || step.email_templates?.body_html || ""
              ),
              wait_days: step.delay_days,
            }));
            const sequenceResult = await setCampaignSequence(smartleadCampaignId, sequenceSteps);
            if (!sequenceResult.ok) {
              res.status(502).json({
                message: `Smartlead campaign was created but the sequence upload failed: ${sequenceResult.message}`,
              });
              return;
            }

            const accountResult = await attachEmailAccount(smartleadCampaignId, smartleadEmailAccountId);
            if (!accountResult.ok) {
              res.status(502).json({
                message: `Smartlead campaign was created but attaching the mailbox failed: ${accountResult.message}`,
              });
              return;
            }
          }
          data.smartlead_campaign_id = smartleadCampaignId;
        } else if (
          (nextStatus === "paused" || nextStatus === "cancelled" || nextStatus === "completed") &&
          existing.smartlead_campaign_id
        ) {
          const stopResult = await updateCampaignStatus(
            existing.smartlead_campaign_id,
            nextStatus === "paused" ? "PAUSED" : "STOPPED"
          );
          if (!stopResult.ok) {
            res.status(502).json({
              message: `Couldn't ${nextStatus === "paused" ? "pause" : "stop"} the Smartlead campaign: ${stopResult.message}. Local status was not changed.`,
            });
            return;
          }
        }
      }

      // Brevo-provider campaigns: unlike Smartlead, there's nothing to mirror on launch (Brevo
      // is a plain transport, not a system of record), but we still must not flip a campaign to
      // "active" if BREVO_API_KEY isn't set — otherwise every contact silently fails at send time
      // in sendQueueTick.ts instead of being blocked upfront.
      if (existing.send_provider === "brevo" && nextStatus === "active" && !brevoConfigured()) {
        res.status(400).json({ message: "Brevo isn't configured (BREVO_API_KEY missing)." });
        return;
      }

      const updated = await prisma.campaign.update({
        where: { id },
        data,
        include: {
          email_provider_accounts: { select: { account_email: true } },
          _count: { select: { campaign_steps: true, campaign_contacts: true } },
        },
      });

      // "cancelled" is intentionally excluded — cancellation isn't "done," it's abandoned, and a
      // distinct notification for that wasn't asked for. See
      // .claude/schema_v2_campaigns_discord_notifications.md §5/§7.
      if (nextStatus === "completed" && discordConfigured()) {
        const [sentCount, contactCount] = await Promise.all([
          prisma.emailOutboundMessage.count({ where: { campaign_id: id } }),
          prisma.campaignContact.count({ where: { campaign_id: id } }),
        ]);
        const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
        await notifyDiscord(
          `✅ **Campaign completed** — ${existing.name}\n` +
            `${sentCount} sent to ${contactCount} contacts` +
            (base ? `\n${base}/panel/email?campaign=${id}&tab=analytics` : "")
        );
      }

      res.status(200).json({ campaign: serializeCampaign(updated) });
      return;
    }

    // Designating this campaign as the signal auto-enrollment target is allowed in any
    // status (you'd typically flag a live nurture sequence).
    if (req.body?.enrollOnSignal !== undefined) {
      const updated = await prisma.campaign.update({
        where: { id },
        data: { enroll_on_signal: Boolean(req.body.enrollOnSignal) },
        include: {
          email_provider_accounts: { select: { account_email: true } },
          _count: { select: { campaign_steps: true, campaign_contacts: true } },
        },
      });
      res.status(200).json({ campaign: serializeCampaign(updated) });
      return;
    }

    if (existing.status !== "draft") {
      res.status(400).json({ message: "Send settings can only be edited while the campaign is a draft." });
      return;
    }

    const sendDelaySeconds = Number(req.body?.sendDelaySeconds);
    const sendJitterSeconds = Number(req.body?.sendJitterSeconds);
    const dailySendLimit = Number(req.body?.dailySendLimit);
    const scheduledStartAtRaw = req.body?.scheduledStartAt;

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: req.body?.name !== undefined ? asStr(req.body?.name) || existing.name : existing.name,
        send_delay_seconds:
          req.body?.sendDelaySeconds !== undefined && Number.isFinite(sendDelaySeconds) && sendDelaySeconds >= 30
            ? Math.floor(sendDelaySeconds)
            : existing.send_delay_seconds,
        send_jitter_seconds:
          req.body?.sendJitterSeconds !== undefined && Number.isFinite(sendJitterSeconds) && sendJitterSeconds >= 0
            ? Math.floor(sendJitterSeconds)
            : existing.send_jitter_seconds,
        daily_send_limit:
          req.body?.dailySendLimit !== undefined && Number.isFinite(dailySendLimit) && dailySendLimit > 0
            ? Math.floor(dailySendLimit)
            : existing.daily_send_limit,
        scheduled_start_at:
          req.body?.scheduledStartAt !== undefined
            ? (asStr(scheduledStartAtRaw) ? new Date(asStr(scheduledStartAtRaw)) : null)
            : existing.scheduled_start_at,
        audience_filter: req.body?.audienceFilter !== undefined ? req.body.audienceFilter : existing.audience_filter,
      },
      include: {
        email_provider_accounts: { select: { account_email: true } },
        _count: { select: { campaign_steps: true, campaign_contacts: true } },
      },
    });
    res.status(200).json({ campaign: serializeCampaign(updated) });
    return;
  }

  if (req.method === "DELETE") {
    if (existing.status !== "draft") {
      res.status(400).json({ message: "Only draft campaigns can be deleted." });
      return;
    }
    await prisma.campaign.delete({ where: { id } });
    res.status(200).json({ ok: true });
    return;
  }
}, { methods: ["GET", "PATCH", "DELETE"] });
