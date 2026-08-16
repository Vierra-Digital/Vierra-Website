import { prisma } from "@/lib/prisma";
import { notifySignal, discordConfigured } from "@/lib/notify/discord";

/**
 * Signal-based outreach (v1): scan recent tracked-link CLICKS — a high-intent signal —
 * and, when the click maps to a campaign contact, advance their lead status to
 * "positive_response" and alert the team on Discord. Runs on the inbound cron (every ~5 min)
 * so it stays off the click-redirect hot path.
 *
 * Idempotent: only acts on contacts still at the default "no_response" status, so re-scanning
 * the overlap window never double-fires and a contact already categorized (by a reply, a
 * manual action, or a prior signal) is never overwritten. Full signal-triggered sequence
 * enrollment is a later enhancement.
 *
 * lead_status must be one of the canonical LEAD_STATUSES (lib/api/campaigns.ts) — writing an
 * arbitrary string here would bypass that validation (only the manual PATCH endpoint enforces
 * it) and leave the contact with a status the rest of the app (labels, filters, stats) doesn't
 * recognize.
 */
const SIGNAL_LEAD_STATUS = "positive_response";

export async function processSignals(now: Date): Promise<{ signals: number; enrolled: number }> {
  const windowStart = new Date(now.getTime() - 6 * 60 * 1000);
  let signals = 0;
  let enrolled = 0;

  const clicks = await prisma.emailTrackingEvent.findMany({
    where: { event_type: "CLICK", occurred_at: { gte: windowStart } },
    orderBy: { occurred_at: "desc" },
    take: 100,
    select: {
      email_outbound_messages: {
        select: {
          subject: true,
          account_id: true,
          email_outbound_recipients: { where: { recipient_type: "TO" }, select: { email: true }, take: 1 },
        },
      },
    },
  });

  const seen = new Set<string>();
  for (const c of clicks) {
    const email = c.email_outbound_messages?.email_outbound_recipients?.[0]?.email?.toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);

    // Scope to the account that sent the clicked email so a prospect shared across tenants'
    // campaigns only advances the right tenant's contact.
    const messageAccountId = c.email_outbound_messages?.account_id;
    const contact = await prisma.campaignContact.findFirst({
      where: {
        contact_email: email,
        ...(messageAccountId ? { campaigns: { account_id: messageAccountId } } : {}),
      },
      orderBy: { enrolled_at: "desc" },
      select: {
        id: true,
        lead_status: true,
        campaign_id: true,
        contact_id: true,
        contact_first_name: true,
        contact_last_name: true,
        contact_business: true,
        campaigns: { select: { company_id: true, name: true } },
      },
    });
    if (!contact || contact.lead_status !== "no_response") continue;

    await prisma.campaignContact.update({
      where: { id: contact.id },
      data: { lead_status: SIGNAL_LEAD_STATUS, updated_at: now },
    });
    await prisma.leadStatusEvent.create({
      data: {
        campaign_contact_id: contact.id,
        from_status: contact.lead_status,
        to_status: SIGNAL_LEAD_STATUS,
        changed_by_rule: "link_click_signal",
        note: "Clicked a tracked link.",
      },
    });
    if (discordConfigured()) {
      await notifySignal({
        contactEmail: email,
        campaignName: contact.campaigns?.name,
        kind: "click",
        subject: c.email_outbound_messages?.subject,
      });
    }
    signals += 1;

    // Signal-triggered enrollment: if this contact's company has a campaign flagged
    // enroll_on_signal, enroll them into it (once) so a nurture sequence starts. The
    // send-queue tick picks up the new queued contact. Idempotent per (campaign, email).
    const companyId = contact.campaigns?.company_id;
    if (companyId) {
      const target = await prisma.campaign.findFirst({
        where: { company_id: companyId, enroll_on_signal: true, status: "active" },
        select: { id: true, name: true },
      });
      if (target && target.id !== contact.campaign_id) {
        const already = await prisma.campaignContact.findFirst({
          where: { campaign_id: target.id, contact_email: email },
          select: { id: true },
        });
        if (!already) {
          await prisma.campaignContact.create({
            data: {
              campaign_id: target.id,
              contact_email: email,
              contact_id: contact.contact_id,
              contact_first_name: contact.contact_first_name,
              contact_last_name: contact.contact_last_name,
              contact_business: contact.contact_business,
              lead_status: SIGNAL_LEAD_STATUS,
              queue_status: "queued",
              next_send_at: now,
            },
          });
          enrolled += 1;
          if (discordConfigured()) {
            await notifySignal({ contactEmail: email, campaignName: target.name, kind: "enrolled" });
          }
        }
      }
    }
  }

  return { signals, enrolled };
}
