import { withCronAuth } from "../_shared/auth.ts";
import { getValidGmailAccessToken } from "../_shared/gmail.ts";
import {
  findPlatformTokenByPrefix,
  getValidMsTeamsAccessTokenForUser,
  getValidZoomAccessTokenForUser,
  mergePlatformTokenMeta,
} from "../_shared/oauthTokens.ts";
import { computeAttendance, getMeetAttendance, getTeamsAttendance, getZoomAttendance } from "../_shared/attendanceProviders.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type SyncResult = "held" | "not_held" | "skipped" | "no_data";

async function fetchAttendanceParticipants(
  supabase: SupabaseClient,
  provider: string,
  hostUserId: string,
  gmailAccountEmail: string,
  providerMeetingId: string
) {
  if (provider === "google_meet") {
    const token = await getValidGmailAccessToken(supabase, hostUserId, gmailAccountEmail);
    if (!token.ok) {
      if (token.reason === "refresh_failed" || token.reason === "no_refresh_token") {
        await mergePlatformTokenMeta(supabase, hostUserId, `gmail:${gmailAccountEmail}`, { needsReconnect: true });
      }
      return "skipped" as const;
    }
    return getMeetAttendance(token.accessToken, providerMeetingId);
  }

  if (provider === "zoom") {
    const token = await getValidZoomAccessTokenForUser(supabase, hostUserId);
    if (!token.ok) {
      if (token.reason === "refresh_failed" || token.reason === "no_refresh_token") {
        const row = await findPlatformTokenByPrefix(supabase, hostUserId, "zoom:");
        if (row) await mergePlatformTokenMeta(supabase, hostUserId, row.platform, { needsReconnect: true });
      }
      return "skipped" as const;
    }
    return getZoomAttendance(token.accessToken, providerMeetingId);
  }

  if (provider === "microsoft_teams") {
    const token = await getValidMsTeamsAccessTokenForUser(supabase, hostUserId);
    if (!token.ok) {
      if (token.reason === "refresh_failed" || token.reason === "no_refresh_token") {
        const row = await findPlatformTokenByPrefix(supabase, hostUserId, "msteams:");
        if (row) await mergePlatformTokenMeta(supabase, hostUserId, row.platform, { needsReconnect: true });
      }
      return "skipped" as const;
    }
    const participants = await getTeamsAttendance(token.accessToken, providerMeetingId);
    if (participants !== null) {
      const row = await findPlatformTokenByPrefix(supabase, hostUserId, "msteams:");
      if (row && !(row.meta as { attendanceReportsAvailable?: boolean } | null)?.attendanceReportsAvailable) {
        await mergePlatformTokenMeta(supabase, hostUserId, row.platform, { attendanceReportsAvailable: true });
      }
    }
    return participants;
  }

  return "skipped" as const;
}

type BookingRow = {
  id: string;
  provider: string;
  provider_meeting_id: string | null;
  invitee_email: string;
  start_at: string;
  end_at: string;
  attendance_status: string;
  attendance_source: string | null;
  booking_links: { user_id: string; account_email: string } | null;
};

async function syncOne(supabase: SupabaseClient, booking: BookingRow): Promise<SyncResult> {
  if (booking.attendance_source === "manual_override") return "skipped";
  if (new Date(booking.end_at).getTime() > Date.now()) return "skipped";
  if (!booking.provider_meeting_id || !booking.booking_links) return "no_data";

  const link = booking.booking_links;
  const participants = await fetchAttendanceParticipants(supabase, booking.provider, link.user_id, link.account_email, booking.provider_meeting_id);
  if (participants === null) return "no_data";
  if (participants === "skipped") return "skipped";

  const { held, attendeeCount, durationSeconds } = computeAttendance({
    inviteeEmail: booking.invitee_email,
    participants,
    meetingStartIso: booking.start_at,
    meetingEndIso: booking.end_at,
  });

  const toStatus = held ? "held" : "not_held";
  const { error } = await supabase.rpc("record_attendance_sync", {
    p_booking_id: booking.id,
    p_to_status: toStatus,
    p_attendee_emails: participants,
    p_attendee_count: attendeeCount,
    p_duration_seconds: durationSeconds,
    p_held: held,
  });
  if (error) throw error;

  return toStatus;
}

/**
 * Cron dispatch for the attendance-sync reconciliation poll (hourly). Edge Function port of
 * pages/api/booking/sync-attendance/dispatch.ts + lib/booking/syncAttendance.ts.
 */
Deno.serve(
  withCronAuth(async (_req, supabase) => {
    const { data: due, error } = await supabase
      .from("bookings")
      .select("id, provider, provider_meeting_id, invitee_email, start_at, end_at, attendance_status, attendance_source, booking_links(user_id, account_email)")
      .eq("attendance_status", "booked")
      .lt("end_at", new Date().toISOString())
      .limit(200);
    if (error) {
      console.error("sync-attendance dispatch: candidate query failed", error);
      return Response.json({ message: "Failed to load candidates." }, { status: 500 });
    }

    const totals = { checked: (due || []).length, held: 0, not_held: 0, no_data: 0, skipped: 0 };
    for (const booking of (due || []) as unknown as BookingRow[]) {
      try {
        const result = await syncOne(supabase, booking);
        totals[result] += 1;
      } catch (err) {
        console.error("sync-attendance dispatch: booking sync failed", booking.id, err);
        totals.skipped += 1;
      }
    }

    return Response.json(totals);
  })
);
