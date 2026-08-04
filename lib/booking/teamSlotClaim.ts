import type { NextApiRequest, NextApiResponse } from "next";
import type { BookingLink } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeSlots, DEFAULT_AVAILABILITY, type Availability } from "@/lib/booking/slots";
import { getTeamBusyIntersection } from "@/lib/booking/teamAvailability";
import { sendEmailCore, escapeHtml } from "@/lib/gmail/sendCore";

const CLAIM_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * A prospect claims a time slot on a team (round-robin) booking link. No specific host is
 * assigned yet — the booking lands as status='slot_claimed' on the org's open-slots queue
 * (GET /api/booking/org-queue) for any member to claim, or gets auto-assigned after 12h
 * (netlify/functions/auto-assign-meetings.ts). See MEETING_TRACKING_QUESTIONS.md §15/§25/§29/§32.
 *
 * Simplification for v1: once claimed by one prospect, a time slot is considered taken for
 * that link even if multiple members would have been free at that time (same one-booking-per-
 * slot model as solo links) — true per-member concurrent capacity isn't modeled yet.
 */
export async function handleTeamSlotClaim(
  req: NextApiRequest,
  res: NextApiResponse,
  link: BookingLink,
  opts: { start: Date; end: Date; inviteeName: string; inviteeEmail: string; notes: string; campaignContactId: string }
) {
  const { start, end, inviteeName, inviteeEmail, notes, campaignContactId } = opts;
  const companyId = link.company_id;
  if (!companyId) {
    res.status(500).json({ message: "This link is misconfigured." });
    return;
  }

  const now = new Date();
  const validationRangeEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  const localBookings = await prisma.booking.findMany({
    where: { booking_link_id: link.id, status: { in: ["confirmed", "slot_claimed"] }, end_at: { gt: now } },
    select: { start_at: true, end_at: true },
  });
  const teamBusy = await getTeamBusyIntersection(companyId, now.toISOString(), validationRangeEnd.toISOString());
  const busy = [...teamBusy, ...localBookings.map((b) => ({ start: b.start_at.toISOString(), end: b.end_at.toISOString() }))];

  const availability = (link.availability as unknown as Availability) || DEFAULT_AVAILABILITY;
  const offered = computeSlots({
    availability,
    durationMinutes: link.duration_minutes,
    bufferMinutes: link.buffer_minutes,
    busy,
    rangeStart: now,
    rangeEnd: validationRangeEnd,
    nowMs: now.getTime(),
    timeZone: link.timezone || "UTC",
  });
  if (!offered.includes(start.toISOString())) {
    res.status(409).json({ message: "That time isn't available — please pick another." });
    return;
  }

  const booking = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${link.id}`}))`;
    const conflict = await tx.booking.findFirst({
      where: { booking_link_id: link.id, status: { in: ["confirmed", "slot_claimed"] }, start_at: { lt: end }, end_at: { gt: start } },
      select: { id: true },
    });
    if (conflict) return null;
    return tx.booking.create({
      data: {
        booking_link_id: link.id,
        invitee_name: inviteeName,
        invitee_email: inviteeEmail,
        invitee_notes: notes || null,
        start_at: start,
        end_at: end,
        status: "slot_claimed",
        provider: link.provider,
        campaign_contact_id: campaignContactId || null,
        claim_deadline_at: new Date(Date.now() + CLAIM_WINDOW_MS),
      },
    });
  });
  if (!booking) {
    res.status(409).json({ message: "That time was just taken — please pick another." });
    return;
  }

  if (campaignContactId) {
    await prisma.campaignContact
      .updateMany({ where: { id: campaignContactId, lead_status: "no_response" }, data: { lead_status: "follow_up" } })
      .catch(() => {});
  }

  const when = start.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: link.timezone || "UTC" });
  const safeName = escapeHtml(inviteeName);
  const safeTitle = escapeHtml(link.title);
  const confirmationHtml = `<p>Hi ${safeName},</p><p>You're on the calendar for <strong>${safeTitle}</strong> at <strong>${when} (${link.timezone || "UTC"})</strong>. We're matching you with the right person on our team — you'll get the meeting link shortly.</p>`;

  await sendEmailCore(
    link.user_id,
    {
      accountEmail: link.account_email,
      to: inviteeEmail,
      subject: `Booked: ${link.title}`,
      bodyHtml: confirmationHtml,
      body: `You're on the calendar for "${link.title}" at ${when}. We're matching you with the right person on our team.`,
    },
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "")
  ).catch(() => null);

  res.status(200).json({ ok: true, when, pendingAssignment: true });
}
