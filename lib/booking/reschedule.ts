import { prisma } from "@/lib/prisma";
import { computeSlots, DEFAULT_AVAILABILITY, type Availability } from "@/lib/booking/slots";
import { getTeamBusyIntersection, findFirstGmailAccountForUser } from "@/lib/booking/teamAvailability";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getBusy, cancelCalendarEvent, type BusyInterval } from "@/lib/calendar/googleCalendar";
import { getValidZoomAccessTokenForUser } from "@/lib/zoom/tokens";
import { getValidMsTeamsAccessTokenForUser } from "@/lib/msteams/tokens";
import { cancelZoomMeeting } from "@/lib/calendar/zoomMeetings";
import { cancelTeamsMeeting } from "@/lib/calendar/msTeamsMeetings";
import { provisionBookingMeeting } from "@/lib/booking/provisionMeeting";
import { sendEmailCore, escapeHtml } from "@/lib/gmail/sendCore";

type RescheduleResult = { ok: true } | { ok: false; message: string };

/** Which user's calendar/provider tokens the meeting is provisioned under, for the current booking state. */
function resolveHostUserId(booking: { claimed_by_user_id: string | null; booking_links: { user_id: string; company_id: string | null } }): string {
  if (booking.booking_links.company_id) return booking.claimed_by_user_id || booking.booking_links.user_id;
  return booking.booking_links.user_id;
}

async function cancelExistingMeeting(hostUserId: string, booking: { provider: string; google_event_id: string | null; provider_meeting_id: string | null }) {
  const gmailEmail = await findFirstGmailAccountForUser(hostUserId);
  if (gmailEmail && booking.google_event_id) {
    const token = await getValidGmailAccessToken(hostUserId, gmailEmail);
    if (token.ok) await cancelCalendarEvent(token.accessToken, booking.google_event_id).catch(() => false);
  }
  if (booking.provider === "zoom" && booking.provider_meeting_id) {
    const token = await getValidZoomAccessTokenForUser(hostUserId);
    if (token.ok) await cancelZoomMeeting(token.accessToken, booking.provider_meeting_id).catch(() => false);
  } else if (booking.provider === "microsoft_teams" && booking.provider_meeting_id) {
    const token = await getValidMsTeamsAccessTokenForUser(hostUserId);
    if (token.ok) await cancelTeamsMeeting(token.accessToken, booking.provider_meeting_id).catch(() => false);
  }
}

/**
 * Reschedule a booking (host- or prospect-initiated, no minimum notice window per
 * MEETING_TRACKING_QUESTIONS.md §14/§27) — mutates start_at/end_at in place and logs
 * booking_reschedule_events, rather than closing/recreating the row. If a real meeting already
 * existed, it's cancelled and re-provisioned at the new time (same host).
 */
export async function rescheduleBooking(bookingId: string, newStart: Date, rescheduledBy: "host" | "prospect"): Promise<RescheduleResult> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { booking_links: true } });
  if (!booking) return { ok: false, message: "Booking not found." };
  if (booking.status === "cancelled") return { ok: false, message: "This booking was cancelled." };
  if (Number.isNaN(newStart.getTime()) || newStart.getTime() <= Date.now()) return { ok: false, message: "Pick a valid future time." };

  const link = booking.booking_links;
  const newEnd = new Date(newStart.getTime() + link.duration_minutes * 60 * 1000);
  const now = new Date();
  const validationRangeEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000);

  const localBookings = await prisma.booking.findMany({
    where: { booking_link_id: link.id, id: { not: booking.id }, status: { in: ["confirmed", "slot_claimed"] }, end_at: { gt: now } },
    select: { start_at: true, end_at: true },
  });
  const hostUserId = resolveHostUserId(booking);

  let busy: BusyInterval[];
  if (link.company_id) {
    busy = await getTeamBusyIntersection(link.company_id, now.toISOString(), validationRangeEnd.toISOString());
  } else {
    const token = await getValidGmailAccessToken(link.user_id, link.account_email);
    busy = token.ok ? await getBusy(token.accessToken, now.toISOString(), validationRangeEnd.toISOString()) : [];
  }
  busy = [...busy, ...localBookings.map((b) => ({ start: b.start_at.toISOString(), end: b.end_at.toISOString() }))];

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
  if (!offered.includes(newStart.toISOString())) return { ok: false, message: "That time isn't available — please pick another." };

  let googleEventId: string | null = booking.google_event_id;
  let providerMeetingId: string | null = booking.provider_meeting_id;
  let joinUrl: string | null = booking.meeting_join_url;

  if (booking.status === "confirmed" && (booking.google_event_id || booking.provider_meeting_id)) {
    await cancelExistingMeeting(hostUserId, booking);
    const hostGmailEmail = (await findFirstGmailAccountForUser(hostUserId)) || link.account_email;
    const provisioned = await provisionBookingMeeting({
      hostUserId,
      hostGmailAccountEmail: hostGmailEmail,
      provider: booking.provider,
      summary: `${link.title} — ${booking.invitee_name}`,
      description: booking.invitee_notes ? `Booked via Vierra.\n\nNotes: ${booking.invitee_notes}` : "Booked via Vierra.",
      startIso: newStart.toISOString(),
      endIso: newEnd.toISOString(),
      timezone: link.timezone || "UTC",
      durationMinutes: link.duration_minutes,
      attendeeEmails: [booking.invitee_email],
    });
    googleEventId = provisioned.googleEventId;
    providerMeetingId = provisioned.providerMeetingId;
    joinUrl = provisioned.joinUrl;
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { start_at: newStart, end_at: newEnd, google_event_id: googleEventId, provider_meeting_id: providerMeetingId, meeting_join_url: joinUrl },
    }),
    prisma.bookingRescheduleEvent.create({
      data: { booking_id: bookingId, previous_start_at: booking.start_at, new_start_at: newStart, rescheduled_by: rescheduledBy },
    }),
  ]);

  const when = newStart.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: link.timezone || "UTC" });
  const joinLinkHtml = joinUrl ? `<p>Join link: <a href="${escapeHtml(joinUrl)}">${escapeHtml(joinUrl)}</a></p>` : "";
  const notifyEmail = (await findFirstGmailAccountForUser(hostUserId)) || link.account_email;
  await sendEmailCore(
    hostUserId,
    {
      accountEmail: notifyEmail,
      to: booking.invitee_email,
      subject: `Rescheduled: ${link.title}`,
      bodyHtml: `<p>Hi ${escapeHtml(booking.invitee_name)},</p><p>Your meeting <strong>${escapeHtml(link.title)}</strong> has been moved to <strong>${when} (${link.timezone || "UTC"})</strong>.</p>${joinLinkHtml}`,
      body: `Your meeting "${link.title}" has been moved to ${when}.`,
    },
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "")
  ).catch(() => null);

  return { ok: true };
}

/** Cancel a booking — cancels any real meeting/calendar event too. No minimum notice window. */
export async function cancelBooking(bookingId: string): Promise<RescheduleResult> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { booking_links: true } });
  if (!booking) return { ok: false, message: "Booking not found." };
  if (booking.status === "cancelled") return { ok: true };

  const hostUserId = resolveHostUserId(booking);
  if (booking.status === "confirmed") await cancelExistingMeeting(hostUserId, booking);

  await prisma.booking.update({ where: { id: bookingId }, data: { status: "cancelled" } });

  const link = booking.booking_links;
  const notifyEmail = (await findFirstGmailAccountForUser(hostUserId)) || link.account_email;
  await sendEmailCore(
    hostUserId,
    {
      accountEmail: notifyEmail,
      to: booking.invitee_email,
      subject: `Cancelled: ${link.title}`,
      bodyHtml: `<p>Hi ${escapeHtml(booking.invitee_name)},</p><p>Your meeting <strong>${escapeHtml(link.title)}</strong> has been cancelled.</p>`,
      body: `Your meeting "${link.title}" has been cancelled.`,
    },
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "")
  ).catch(() => null);

  return { ok: true };
}
