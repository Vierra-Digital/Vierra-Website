/** Zoom meeting creation + attendance-report helpers for the meeting booker (Phase 2). */
const ZOOM = "https://api.zoom.us/v2";

export type CreatedProviderMeeting = { meetingId: string; joinUrl: string | null };

/** Create a scheduled Zoom meeting. Returns null on any failure (caller falls back to .ics-only). */
export async function createZoomMeeting(
  accessToken: string,
  opts: { topic: string; startIso: string; durationMinutes: number; timezone: string }
): Promise<CreatedProviderMeeting | null> {
  try {
    const res = await fetch(`${ZOOM}/users/me/meetings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: opts.topic,
        type: 2, // scheduled meeting
        start_time: opts.startIso,
        duration: opts.durationMinutes,
        timezone: opts.timezone,
        settings: { join_before_host: true, waiting_room: false },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { id?: number; join_url?: string };
    if (data.id == null) return null;
    return { meetingId: String(data.id), joinUrl: data.join_url || null };
  } catch {
    return null;
  }
}

/** Best-effort cancel (used on booking cancel/reassign). */
export async function cancelZoomMeeting(accessToken: string, meetingId: string): Promise<boolean> {
  try {
    const res = await fetch(`${ZOOM}/meetings/${encodeURIComponent(meetingId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export type ZoomParticipant = { email: string | null; startTime: string; endTime: string | null };

/**
 * Past-meeting participant report. Requires the Zoom Report API, which is generally gated to
 * Licensed+ accounts (see lib/zoom/tokens.ts's connect-time heuristic and DESIGN.md §14.13 —
 * needs verification against current Zoom docs). Returns null on any failure: not ended yet,
 * plan doesn't support reports, or a transient error — callers treat that as "no data yet",
 * not an error, and fall back to CSV import if the gate turns out to be permanent.
 */
export async function getZoomAttendance(accessToken: string, meetingId: string): Promise<ZoomParticipant[] | null> {
  try {
    const res = await fetch(`${ZOOM}/report/meetings/${encodeURIComponent(meetingId)}/participants?page_size=300`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      participants?: Array<{ user_email?: string; join_time?: string; leave_time?: string }>;
    };
    return (data.participants || []).map((p) => ({
      email: p.user_email ? p.user_email.toLowerCase() : null,
      startTime: p.join_time || new Date(0).toISOString(),
      endTime: p.leave_time || null,
    }));
  } catch {
    return null;
  }
}
