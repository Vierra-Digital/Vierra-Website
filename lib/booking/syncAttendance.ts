import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getMeetAttendance } from "@/lib/calendar/googleMeet";
import { getValidZoomAccessTokenForUser } from "@/lib/zoom/tokens";
import { getValidMsTeamsAccessTokenForUser } from "@/lib/msteams/tokens";
import { getZoomAttendance } from "@/lib/calendar/zoomMeetings";
import { getTeamsAttendance } from "@/lib/calendar/msTeamsMeetings";
import { mergePlatformTokenMeta, findPlatformTokenByPrefix } from "@/lib/api/genericOAuthToken";
import { computeAttendance, type AttendanceParticipant } from "@/lib/booking/attendance";
import type { Prisma } from "@/lib/generated/prisma/client";

export type SyncResult = "held" | "not_held" | "skipped" | "no_data";

/**
 * Resolve the provider-specific token, flag needsReconnect on refresh failure, and fetch the
 * raw participant list. Returns "skipped" for token problems (host action required, not a data
 * problem) and null for "no data yet" (not started/ended, plan-gated, or record expired).
 */
async function fetchAttendanceParticipants(
  provider: string,
  hostUserId: string,
  gmailAccountEmail: string,
  providerMeetingId: string
): Promise<AttendanceParticipant[] | null | "skipped"> {
  if (provider === "google_meet") {
    const token = await getValidGmailAccessToken(hostUserId, gmailAccountEmail);
    if (!token.ok) {
      if (token.reason === "refresh_failed" || token.reason === "no_refresh_token") {
        await mergePlatformTokenMeta(hostUserId, `gmail:${gmailAccountEmail}`, { needsReconnect: true });
      }
      return "skipped";
    }
    return getMeetAttendance(token.accessToken, providerMeetingId);
  }

  if (provider === "zoom") {
    const token = await getValidZoomAccessTokenForUser(hostUserId);
    if (!token.ok) {
      if (token.reason === "refresh_failed" || token.reason === "no_refresh_token") {
        const row = await findPlatformTokenByPrefix(hostUserId, "zoom:");
        if (row) await mergePlatformTokenMeta(hostUserId, row.platform, { needsReconnect: true });
      }
      return "skipped";
    }
    return getZoomAttendance(token.accessToken, providerMeetingId);
  }

  if (provider === "microsoft_teams") {
    const token = await getValidMsTeamsAccessTokenForUser(hostUserId);
    if (!token.ok) {
      if (token.reason === "refresh_failed" || token.reason === "no_refresh_token") {
        const row = await findPlatformTokenByPrefix(hostUserId, "msteams:");
        if (row) await mergePlatformTokenMeta(hostUserId, row.platform, { needsReconnect: true });
      }
      return "skipped";
    }
    const participants = await getTeamsAttendance(token.accessToken, providerMeetingId);
    // No reliable "do we have admin consent" signal at connect time (see pages/api/msteams/callback.ts) —
    // detect it lazily: the first time a real report comes back, remember it for the plan-tier
    // gating check in pages/api/booking/links/index.ts.
    if (participants !== null) {
      const row = await findPlatformTokenByPrefix(hostUserId, "msteams:");
      if (row && !(row.meta as { attendanceReportsAvailable?: boolean } | null)?.attendanceReportsAvailable) {
        await mergePlatformTokenMeta(hostUserId, row.platform, { attendanceReportsAvailable: true });
      }
    }
    return participants;
  }

  return "skipped";
}

/**
 * Pull the attendance report for one ended booking and write the outcome. Never throws —
 * callers (the per-booking route and the batch dispatcher) both loop over many bookings and a
 * single provider hiccup shouldn't abort the run.
 *
 * Skips (leaves the booking as-is) when: already resolved by something other than a prior
 * automatic sync (a manual override always wins — see MEETING_TRACKING_QUESTIONS.md §16),
 * the meeting hasn't ended yet, there's no Meet conference to look up (host lacked
 * calendar.events scope at booking time), the host's token can't be refreshed, or the
 * Meet API has no data yet (not Workspace, not started, or record expired).
 */
export async function syncBookingAttendance(bookingId: string): Promise<SyncResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { booking_links: true },
  });
  if (!booking) return "skipped";
  if (booking.attendance_source === "manual_override") return "skipped";
  if (new Date(booking.end_at).getTime() > Date.now()) return "skipped";
  if (!booking.provider_meeting_id) return "no_data";

  const link = booking.booking_links;
  const participants = await fetchAttendanceParticipants(booking.provider, link.user_id, link.account_email, booking.provider_meeting_id);
  if (participants === null) return "no_data";
  if (participants === "skipped") return "skipped";

  const { held, attendeeCount, durationSeconds } = computeAttendance({
    inviteeEmail: booking.invitee_email,
    participants,
    meetingStartIso: booking.start_at.toISOString(),
    meetingEndIso: booking.end_at.toISOString(),
  });

  const toStatus = held ? "held" : "not_held";
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        attendance_status: toStatus,
        attendee_emails: participants as unknown as Prisma.InputJsonValue,
        attendee_count: attendeeCount,
        duration_seconds: durationSeconds,
        held_at: held ? new Date() : null,
        attendance_source: "automatic",
      },
    }),
    prisma.bookingStatusEvent.create({
      data: {
        booking_id: booking.id,
        from_status: booking.attendance_status,
        to_status: toStatus,
        changed_by_user_id: null,
        note: "automatic sync",
      },
    }),
  ]);

  return held ? "held" : "not_held";
}
