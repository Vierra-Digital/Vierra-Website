import { prisma } from "@/lib/prisma";
import { notifyMeetingBooked, discordConfigured } from "@/lib/notify/discord";

/**
 * Shared "a real meeting was booked" transition for campaign contacts, used by the automatic
 * booking-confirmation paths (pages/api/booking/[id]/index.ts, lib/booking/teamSlotClaim.ts).
 * Previously those paths only bumped no_response -> follow_up and never touched lead_status at
 * all otherwise, so the "meeting booked" Discord ping (pages/api/campaigns/[id]/contacts/
 * [contactId].ts) only ever fired when a rep manually re-categorized the contact by hand — the
 * actual booking event never triggered it. This is the automatic counterpart to that manual path;
 * it has its own inline copy of the same update+event+notify shape (driven by a request body
 * leadStatus rather than a resolved contact id), kept separate rather than forced through here.
 *
 * Best-effort: swallows its own errors so a Discord hiccup or a stale/bad campaignContactId never
 * blocks the booking confirmation flow that calls this.
 */
export async function markCampaignContactMeetingBooked(campaignContactId: string, changedByRule: string): Promise<void> {
  try {
    const contact = await prisma.campaignContact.findUnique({
      where: { id: campaignContactId },
      select: {
        id: true,
        lead_status: true,
        contact_email: true,
        contact_first_name: true,
        contact_last_name: true,
        campaign_id: true,
      },
    });
    if (!contact) return;

    // Guarded on the transition, atomically — not "read lead_status, compare, then write" (this
    // function is shared by two separate booking-confirmation call paths per the doc comment
    // above, so two near-simultaneous calls for the same contact could both read the same stale
    // row, both pass a plain equality check, and both write the event + fire the notification).
    // Only the caller whose updateMany actually flips the row is allowed to log/notify.
    const transitioned = await prisma.campaignContact.updateMany({
      where: { id: contact.id, lead_status: { not: "meeting_booked" } },
      data: { lead_status: "meeting_booked" },
    });
    if (transitioned.count === 0) return;

    await prisma.leadStatusEvent.create({
      data: {
        campaign_contact_id: contact.id,
        from_status: contact.lead_status,
        to_status: "meeting_booked",
        changed_by_rule: changedByRule,
        note: "Auto-updated: contact booked a meeting.",
      },
    });

    if (discordConfigured()) {
      const campaign = await prisma.campaign.findUnique({ where: { id: contact.campaign_id }, select: { name: true } });
      const contactName = [contact.contact_first_name, contact.contact_last_name].filter(Boolean).join(" ");
      await notifyMeetingBooked({
        contactEmail: contact.contact_email,
        contactName: contactName || null,
        campaignId: contact.campaign_id,
        campaignName: campaign?.name ?? "(unknown)",
        contactId: contact.id,
      });
    }
  } catch {
    /* best-effort — a booking's own confirmation flow must not fail because of this */
  }
}
