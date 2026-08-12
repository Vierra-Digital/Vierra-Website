/** Microsoft Graph online-meeting creation + attendance-report helpers (Phase 2). */
const GRAPH = "https://graph.microsoft.com/v1.0";

export type CreatedProviderMeeting = { meetingId: string; joinUrl: string | null };

/** Create a Teams online meeting. Returns null on any failure (caller falls back to .ics-only). */
export async function createTeamsMeeting(
  accessToken: string,
  opts: { subject: string; startIso: string; endIso: string }
): Promise<CreatedProviderMeeting | null> {
  try {
    const res = await fetch(`${GRAPH}/me/onlineMeetings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subject: opts.subject, startDateTime: opts.startIso, endDateTime: opts.endIso }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { id?: string; joinWebUrl?: string };
    if (!data.id) return null;
    return { meetingId: data.id, joinUrl: data.joinWebUrl || null };
  } catch {
    return null;
  }
}

/** Best-effort cancel (used on booking cancel/reassign). */
export async function cancelTeamsMeeting(accessToken: string, meetingId: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/me/onlineMeetings/${encodeURIComponent(meetingId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export type TeamsParticipant = { email: string | null; startTime: string; endTime: string | null };

/**
 * Attendance report for an ended Teams meeting. Requires tenant-admin consent for
 * OnlineMeetingArtifact.Read.All (see MEETING_TRACKING_QUESTIONS.md §3) — returns null (403/404/
 * not ready) rather than throwing, same "no data yet, not an error" contract as the Google/Zoom
 * equivalents. Falls back to CSV import when the gate is permanent.
 */
export async function getTeamsAttendance(accessToken: string, meetingId: string): Promise<TeamsParticipant[] | null> {
  try {
    const listRes = await fetch(`${GRAPH}/me/onlineMeetings/${encodeURIComponent(meetingId)}/attendanceReports`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) return null;
    const listData = (await listRes.json().catch(() => ({}))) as { value?: Array<{ id?: string }> };
    const reportId = listData.value?.[listData.value.length - 1]?.id; // most recent report
    if (!reportId) return null;

    const recordsRes = await fetch(
      `${GRAPH}/me/onlineMeetings/${encodeURIComponent(meetingId)}/attendanceReports/${encodeURIComponent(reportId)}/attendanceRecords`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!recordsRes.ok) return null;
    const recordsData = (await recordsRes.json().catch(() => ({}))) as {
      value?: Array<{
        emailAddress?: string;
        attendanceIntervals?: Array<{ joinDateTime?: string; leaveDateTime?: string }>;
      }>;
    };

    const participants: TeamsParticipant[] = [];
    for (const rec of recordsData.value || []) {
      const email = rec.emailAddress ? rec.emailAddress.toLowerCase() : null;
      const intervals = rec.attendanceIntervals || [];
      if (intervals.length === 0) {
        participants.push({ email, startTime: new Date(0).toISOString(), endTime: null });
        continue;
      }
      for (const iv of intervals) {
        participants.push({ email, startTime: iv.joinDateTime || new Date(0).toISOString(), endTime: iv.leaveDateTime || null });
      }
    }
    return participants;
  } catch {
    return null;
  }
}
