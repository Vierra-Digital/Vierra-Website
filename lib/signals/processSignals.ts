import { prisma } from "@/lib/prisma";
import { notifyDiscord, discordConfigured } from "@/lib/notify/discord";

/**
 * Signal-based outreach (v1): scan recent tracked-link CLICKS — a high-intent signal —
 * and, when the click maps to a campaign contact, advance their lead status to "interested"
 * and alert the team on Discord. Runs on the inbound cron (every ~5 min) so it stays off the
 * click-redirect hot path.
 *
 * Idempotent: only acts on contacts not already engaged, so re-scanning the overlap window
 * never double-fires. Full signal-triggered sequence enrollment is a later enhancement.
 */
const ENGAGED = new Set(["interested", "replied", "booked", "won"]);

export async function processSignals(now: Date): Promise<{ signals: number }> {
  const windowStart = new Date(now.getTime() - 6 * 60 * 1000);
  let signals = 0;

  const clicks = await prisma.emailTrackingEvent.findMany({
    where: { event_type: "CLICK", occurred_at: { gte: windowStart } },
    orderBy: { occurred_at: "desc" },
    take: 100,
    select: {
      email_outbound_messages: {
        select: {
          subject: true,
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

    const contact = await prisma.campaignContact.findFirst({
      where: { contact_email: email },
      orderBy: { enrolled_at: "desc" },
      select: { id: true, lead_status: true },
    });
    if (!contact || ENGAGED.has(contact.lead_status)) continue;

    await prisma.campaignContact.update({
      where: { id: contact.id },
      data: { lead_status: "interested", updated_at: now },
    });
    await prisma.leadStatusEvent.create({
      data: {
        campaign_contact_id: contact.id,
        from_status: contact.lead_status,
        to_status: "interested",
        changed_by_rule: "link_click_signal",
        note: "Clicked a tracked link.",
      },
    });
    if (discordConfigured()) {
      await notifyDiscord(
        `🔥 High-intent signal: ${email} clicked a link${c.email_outbound_messages?.subject ? ` in "${c.email_outbound_messages.subject}"` : ""} — marked interested.`
      );
    }
    signals += 1;
  }

  return { signals };
}
