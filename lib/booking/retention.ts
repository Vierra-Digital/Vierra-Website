import { prisma } from "@/lib/prisma";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Null out meeting/attendance PII (invitee name/email/notes, attendee_emails) on bookings whose
 * anchor interaction is >=1 year old — MEETING_TRACKING_QUESTIONS.md §17/§26/§30: fixed 1 year
 * from the contact's FIRST tracked interaction, no rolling reset, scoped narrowly to this PII
 * (not the underlying Contact/CampaignContact record, which has its own separate lifecycle).
 * start_at/end_at/status/attendance_status/attendee_count/duration_seconds are kept — this is
 * PII redaction, not row deletion, so aggregate analytics still work.
 *
 * Anchor: the linked CampaignContact's enrolled_at (first tracked campaign interaction) when
 * the booking came through a campaign link; otherwise the booking's own created_at, since
 * that's the earliest interaction we have any record of for that prospect.
 */
export async function purgeExpiredMeetingPii(): Promise<{ erased: number }> {
  const cutoff = new Date(Date.now() - ONE_YEAR_MS);

  const candidates = await prisma.booking.findMany({
    where: { pii_erased_at: null },
    select: { id: true, created_at: true, campaign_contact_id: true },
    take: 500,
  });
  if (candidates.length === 0) return { erased: 0 };

  const campaignContactIds = candidates.map((c) => c.campaign_contact_id).filter((id): id is string => Boolean(id));
  const anchors = campaignContactIds.length
    ? await prisma.campaignContact.findMany({ where: { id: { in: campaignContactIds } }, select: { id: true, enrolled_at: true } })
    : [];
  const anchorById = new Map(anchors.map((a) => [a.id, a.enrolled_at]));

  const toErase = candidates
    .map((c) => ({ id: c.id, anchor: (c.campaign_contact_id ? anchorById.get(c.campaign_contact_id) : null) || c.created_at }))
    .filter((c) => c.anchor.getTime() <= cutoff.getTime());

  if (toErase.length === 0) return { erased: 0 };

  await prisma.booking.updateMany({
    where: { id: { in: toErase.map((c) => c.id) } },
    data: { invitee_name: "", invitee_email: "", invitee_notes: null, attendee_emails: [], pii_erased_at: new Date() },
  });

  return { erased: toErase.length };
}
