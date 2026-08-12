import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { safeCompare } from "@/lib/crypto";
import { addToDnc } from "@/lib/campaigns/dnc";
import { REMOVE_CONTACT_STATUS } from "@/lib/api/campaigns";

/**
 * Brevo webhook receiver — see .claude/schema_v2_campaigns_brevo_integration.md Flow 2.
 *
 * UNVERIFIED, same caveat as the Smartlead receiver: the event-name casing (`opened` vs
 * `unique_opened`, etc.) and exact payload field names below are built from Brevo's public docs
 * during design, not a fetched live payload. Confirm with a real test event from Brevo's
 * dashboard before this URL is registered as a live Notify URL — see the doc's §10 open decisions.
 *
 * Auth: Brevo's transactional webhooks have no documented signature header, so the mitigation is
 * a shared secret in the URL itself — register
 * `https://<host>/api/campaigns/webhooks/brevo?token=<BREVO_WEBHOOK_TOKEN>` as the Notify URL.
 *
 * Env: BREVO_WEBHOOK_TOKEN (required to accept requests).
 */

type BrevoWebhookPayload = {
  event?: string;
  ["message-id"]?: string;
  ts_event?: string | number;
  [key: string]: unknown;
};

/** Same shape as smartlead.ts's local helper — kept duplicated (not shared) so this file stays a
 * single, isolated, removable diff per the doc's stopgap intent. */
async function upsertDailyStat(
  campaignId: string,
  field: "opens" | "clicks" | "bounces" | "unsubscribes"
) {
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  await prisma.campaignDailyStat.upsert({
    where: { campaign_id_date: { campaign_id: campaignId, date: today } },
    create: { campaign_id: campaignId, date: today, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method not allowed." });
    return;
  }

  const secret = process.env.BREVO_WEBHOOK_TOKEN || "";
  const token = String(req.query.token || "");
  if (!secret || !token || !safeCompare(token, secret)) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  const payload = req.body as BrevoWebhookPayload;
  const eventType = String(payload?.event || "");
  const messageId = String(payload?.["message-id"] || "");
  if (!eventType || !messageId) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  // De-dupe: Brevo's payload has no confirmed single unique-per-event id, so dedupe on a
  // composite key instead (see doc §3/§5).
  const dedupeKey = `${eventType}:${messageId}:${String(payload?.ts_event ?? "")}`;
  try {
    await prisma.brevoWebhookEvent.create({ data: { dedupe_key: dedupeKey, event_type: eventType } });
  } catch {
    // Unique violation = already processed this exact event; ack and stop, don't double-apply.
    res.status(200).json({ ok: true, duplicate: true });
    return;
  }

  // Process BEFORE acking — same reasoning as the Smartlead receiver: this app deploys via
  // Netlify Functions, which can tear the invocation down once the response is sent.
  try {
    await processEvent(eventType, messageId);
  } catch (error) {
    console.error("brevo webhook processing error:", error);
  }

  res.status(200).json({ ok: true });
}

async function processEvent(eventType: string, messageId: string): Promise<void> {
  const outbound = await prisma.emailOutboundMessage.findFirst({
    where: { brevo_message_id: messageId },
    select: { id: true, campaign_id: true, campaign_contact_id: true },
  });
  // Unlike Smartlead's webhook, no CampaignContact resolution is needed — Vierra initiated this
  // send itself, so campaign_id/campaign_contact_id are already stored on the outbound row.
  if (!outbound?.campaign_id || !outbound.campaign_contact_id) return;
  const campaignId = outbound.campaign_id;
  const campaignContactId = outbound.campaign_contact_id;

  switch (eventType) {
    case "delivered":
      // No-op — the send was already recorded synchronously at send time.
      break;

    case "unique_opened":
      // Brevo fires both "unique_opened" (first open only) and "opened" (every open, including
      // the first) for the same open action — counting both would double the first open of every
      // message. "unique_opened" is the once-per-recipient event, so it alone drives the stat.
      await upsertDailyStat(campaignId, "opens");
      break;

    case "opened":
      // Every open, including repeats — intentionally not counted (see "unique_opened" above).
      break;

    case "click":
      await upsertDailyStat(campaignId, "clicks");
      break;

    case "hard_bounce":
    case "blocked":
    case "invalid_email": {
      const contact = await prisma.campaignContact.findUnique({
        where: { id: campaignContactId },
        select: { contact_email: true },
      });
      if (contact) await addToDnc(campaignId, contact.contact_email, "bounce");
      await prisma.campaignContact.update({
        where: { id: campaignContactId },
        data: { queue_status: "failed", skip_reason: eventType },
      });
      await upsertDailyStat(campaignId, "bounces");
      break;
    }

    case "soft_bounce":
    case "deferred":
      // Temporary — no DNC add, log only. New failure mode vs. SMTP: a bounce can arrive after
      // apparent success because Brevo is a relay, not the real mailbox.
      console.warn(`brevo webhook: ${eventType} for message ${messageId} (campaign ${campaignId})`);
      break;

    case "spam": {
      const contact = await prisma.campaignContact.findUnique({
        where: { id: campaignContactId },
        select: { contact_email: true },
      });
      if (contact) await addToDnc(campaignId, contact.contact_email, "spam_complaint");
      await prisma.campaignContact.update({
        where: { id: campaignContactId },
        data: { queue_status: "failed", skip_reason: "spam_complaint" },
      });
      break;
    }

    case "unsubscribed": {
      const contact = await prisma.campaignContact.findUnique({
        where: { id: campaignContactId },
        select: { contact_email: true, lead_status: true },
      });
      if (!contact) return;
      await addToDnc(campaignId, contact.contact_email, "categorization");
      await prisma.campaignContact.update({
        where: { id: campaignContactId },
        data: { lead_status: REMOVE_CONTACT_STATUS, queue_status: "skipped", skip_reason: "unsubscribed" },
      });
      await prisma.leadStatusEvent.create({
        data: {
          campaign_contact_id: campaignContactId,
          from_status: contact.lead_status,
          to_status: REMOVE_CONTACT_STATUS,
          changed_by_rule: "brevo_unsubscribe",
        },
      });
      await upsertDailyStat(campaignId, "unsubscribes");
      break;
    }

    case "error":
      // Brevo-side processing error, not attributable to a specific failure class — log only.
      console.warn(`brevo webhook: error event for message ${messageId} (campaign ${campaignId})`);
      break;

    default:
      console.warn(`brevo webhook: unrecognized event "${eventType}"`);
  }
}
