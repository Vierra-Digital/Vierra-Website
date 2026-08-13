import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { safeCompare } from "@/lib/crypto";
import { addToDnc } from "@/lib/campaigns/dnc";
import { notifyCampaignReply, discordConfigured } from "@/lib/notify/discord";
import { REMOVE_CONTACT_STATUS } from "@/lib/api/campaigns";

/**
 * Smartlead webhook receiver — see .claude/schema_v2_campaigns_smartlead_integration.md Flow 4.
 *
 * UNVERIFIED, per the design doc's §11 open decisions: the signature header name/algorithm, the
 * dedup header, the event-type field name, and every payload field accessed below are built from
 * public blog/help-center content during design, not a fetched primary API reference or sandbox
 * account. Confirm all of this against Smartlead's real webhook documentation — ideally by
 * triggering a real test event from their dashboard and inspecting the actual payload — before
 * this URL is registered as a live webhook.
 *
 * Env: SMARTLEAD_WEBHOOK_SECRET (required to verify X-Smartlead-Signature).
 */

export const config = {
  api: { bodyParser: false }, // need raw body bytes to verify the HMAC signature
};

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifySignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeCompare(signatureHeader, expected);
}

type SmartleadWebhookPayload = {
  event_type?: string;
  lead_id?: string | number;
  campaign_id?: string | number;
  sequence_number?: number;
  subject?: string;
  bounce_type?: string; // guessed: "hard" | "soft"
  [key: string]: unknown;
};

async function upsertDailyStat(
  campaignId: string,
  field: "emails_sent" | "opens" | "clicks" | "replies" | "bounces" | "unsubscribes"
) {
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  await prisma.campaignDailyStat.upsert({
    where: { campaign_id_date: { campaign_id: campaignId, date: today } },
    create: { campaign_id: campaignId, date: today, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}

/** Resolves the local CampaignContact (+ owning campaign) a webhook event refers to. */
async function resolveContact(leadId: string, smartleadCampaignId: string | undefined) {
  return prisma.campaignContact.findFirst({
    where: {
      smartlead_lead_id: leadId,
      ...(smartleadCampaignId ? { campaigns: { smartlead_campaign_id: smartleadCampaignId } } : {}),
    },
    include: { campaigns: { include: { email_provider_accounts: true } } },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method not allowed." });
    return;
  }

  const secret = process.env.SMARTLEAD_WEBHOOK_SECRET || "";
  const rawBody = await readRawBody(req);
  const signature = String(req.headers["x-smartlead-signature"] || "");
  if (!secret || !signature || !verifySignature(rawBody, signature, secret)) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  let payload: SmartleadWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8") || "{}");
  } catch {
    res.status(400).json({ message: "Invalid JSON body." });
    return;
  }

  // De-dupe on Smartlead's retry-identifying header — the same event can arrive more than once.
  const requestId = String(req.headers["x-request-id"] || "");
  if (requestId) {
    try {
      await prisma.smartleadWebhookEvent.create({
        data: { smartlead_request_id: requestId, event_type: payload.event_type || "unknown" },
      });
    } catch {
      // Unique violation = already processed this exact event; ack and stop, don't double-apply.
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
  }

  // Process BEFORE acking, not after — on a serverless host (this app deploys via Netlify
  // Functions) the runtime can tear the invocation down once the HTTP response is sent, which
  // would silently kill an awaited call started after res.json(). Matches the same
  // process-then-respond shape already used by pages/api/gmail/push.ts. Errors are swallowed
  // (logged, not thrown) so a bug in our processing doesn't make Smartlead treat this as failed
  // and pointlessly retry a request whose signature/dedup checks already passed.
  try {
    await processEvent(payload);
  } catch (error) {
    console.error("smartlead webhook processing error:", error);
  }

  res.status(200).json({ ok: true });
}

async function processEvent(payload: SmartleadWebhookPayload): Promise<void> {
  const leadId = payload.lead_id != null ? String(payload.lead_id) : "";
  const smartleadCampaignId = payload.campaign_id != null ? String(payload.campaign_id) : undefined;
  const eventType = (payload.event_type || "").toUpperCase();
  if (!leadId || !eventType) return;

  const contact = await resolveContact(leadId, smartleadCampaignId);
  if (!contact) return; // no local mapping for this lead — nothing to correlate the event to
  const campaign = contact.campaigns;
  const account = campaign.email_provider_accounts;

  switch (eventType) {
    case "EMAIL_SENT": {
      // Best-effort step resolution via sequence_number -> local step_order (the same ordering
      // used when this sequence was pushed in Flow 1's setCampaignSequence). Degrades to just
      // the daily-stat bump + last_sent_at if the step can't be resolved, rather than failing.
      let stepId: string | null = null;
      if (payload.sequence_number != null) {
        const step = await prisma.campaignStep.findFirst({
          where: { campaign_id: campaign.id, step_order: payload.sequence_number },
          select: { id: true },
        });
        stepId = step?.id ?? null;
      }

      const sentAt = new Date();
      const outbound = await prisma.emailOutboundMessage.create({
        data: {
          user_id: account.user_id,
          account_id: account.id,
          campaign_id: campaign.id,
          campaign_contact_id: contact.id,
          step_id: stepId,
          subject: payload.subject || null,
          tracking_enabled: false, // Smartlead's own tracking is the source for opens/clicks here, not this app's pixel
        },
      });

      if (stepId) {
        await prisma.campaignStepSend.upsert({
          where: { campaign_contact_id_step_id: { campaign_contact_id: contact.id, step_id: stepId } },
          create: {
            campaign_contact_id: contact.id,
            step_id: stepId,
            status: "sent",
            scheduled_at: sentAt,
            outbound_message_id: outbound.id,
            attempted_at: sentAt,
            sent_at: sentAt,
          },
          update: { status: "sent", outbound_message_id: outbound.id, attempted_at: sentAt, sent_at: sentAt },
        }).catch(() => {}); // best-effort — a resolved-but-stale step shouldn't block the stat bump below
      }

      await prisma.campaignContact.update({ where: { id: contact.id }, data: { last_sent_at: sentAt } });
      await upsertDailyStat(campaign.id, "emails_sent");
      break;
    }

    case "EMAIL_OPEN":
      await upsertDailyStat(campaign.id, "opens");
      break;

    case "EMAIL_LINK_CLICK":
      await upsertDailyStat(campaign.id, "clicks");
      break;

    case "EMAIL_REPLY": {
      const fromStatus = contact.lead_status;
      const toStatus = "reply";
      await prisma.campaignContact.update({
        where: { id: contact.id },
        data: { lead_status: toStatus, queue_status: "paused" },
      });
      await prisma.leadStatusEvent.create({
        data: {
          campaign_contact_id: contact.id,
          from_status: fromStatus,
          to_status: toStatus,
          changed_by_rule: "smartlead_reply",
          note: "Auto-updated from a Smartlead reply webhook.",
        },
      });
      await upsertDailyStat(campaign.id, "replies");

      // Shared with the "internal"-provider reply notification (lib/gmail/inboundActions.ts
      // maybeNotifyDiscord) via lib/notify/discord.ts notifyCampaignReply, so a reply looks the
      // same in Discord regardless of which provider sent the campaign. See
      // .claude/schema_v2_campaigns_discord_notifications.md §3/§6.
      if (discordConfigured()) {
        await notifyCampaignReply({
          contactEmail: contact.contact_email,
          campaignName: campaign.name,
          leadStatus: toStatus,
          fromStatus,
        });
      }
      break;
    }

    case "EMAIL_BOUNCED": {
      const isHard = (payload.bounce_type || "").toLowerCase() === "hard";
      if (isHard) {
        await addToDnc(campaign.id, contact.contact_email, "bounce");
      }
      await prisma.campaignContact.update({
        where: { id: contact.id },
        data: { queue_status: "failed", skip_reason: isHard ? "hard_bounce" : "soft_bounce" },
      });
      await upsertDailyStat(campaign.id, "bounces");
      break;
    }

    case "LEAD_UNSUBSCRIBED": {
      // "unsubscribed" isn't one of the canonical LEAD_STATUSES (lib/api/campaigns.ts) — mapped
      // to remove_contact, the existing status that already carries DNC/removal semantics.
      await addToDnc(campaign.id, contact.contact_email, "categorization");
      await prisma.campaignContact.update({
        where: { id: contact.id },
        data: { lead_status: REMOVE_CONTACT_STATUS, queue_status: "skipped", skip_reason: "unsubscribed" },
      });
      await prisma.leadStatusEvent.create({
        data: {
          campaign_contact_id: contact.id,
          from_status: contact.lead_status,
          to_status: REMOVE_CONTACT_STATUS,
          changed_by_rule: "smartlead_unsubscribe",
        },
      });
      await upsertDailyStat(campaign.id, "unsubscribes");
      break;
    }

    case "CAMPAIGN_STATUS_CHANGED":
      // Deliberately not wired: design doc §7/§11 flags auto-completing the local Campaign.status
      // from this event as NEW behavior (internal-provider campaigns have no equivalent today)
      // that needs an explicit yes/no before being built, not assumed. Confirm with the user,
      // then implement here if wanted.
      break;

    default:
      // Unrecognized event type — likely means the real payload uses different naming than
      // guessed here; log so a mismatch surfaces during initial testing rather than silently
      // dropping events.
      console.warn(`smartlead webhook: unrecognized event_type "${payload.event_type}"`);
  }
}
