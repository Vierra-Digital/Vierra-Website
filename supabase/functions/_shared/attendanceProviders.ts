// Deno port of lib/calendar/googleMeet.ts, lib/calendar/zoomMeetings.ts, lib/calendar/msTeamsMeetings.ts
// (attendance-report fetchers only — meeting creation/cancel isn't needed by the sync-attendance
// dispatch) and lib/booking/attendance.ts's computeAttendance.

export type AttendanceParticipant = { email: string | null; startTime: string; endTime: string | null };

const MEET = "https://meet.googleapis.com/v2";
const PEOPLE = "https://people.googleapis.com/v1";
const ZOOM = "https://api.zoom.us/v2";
const GRAPH = "https://graph.microsoft.com/v1.0";

async function resolveParticipantEmail(accessToken: string, personResource: string | undefined): Promise<string | null> {
  if (!personResource) return null;
  try {
    const res = await fetch(`${PEOPLE}/${personResource}?personFields=emailAddresses`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { emailAddresses?: Array<{ value?: string }> };
    return data.emailAddresses?.[0]?.value?.toLowerCase() || null;
  } catch {
    return null;
  }
}

export async function getMeetAttendance(accessToken: string, meetingCode: string): Promise<AttendanceParticipant[] | null> {
  try {
    const searchRes = await fetch(
      `${MEET}/conferenceRecords?filter=${encodeURIComponent(`space.meeting_code="${meetingCode}"`)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!searchRes.ok) return null;
    const searchData = (await searchRes.json().catch(() => ({}))) as { conferenceRecords?: Array<{ name?: string }> };
    const conferenceRecordName = searchData.conferenceRecords?.[0]?.name;
    if (!conferenceRecordName) return null;

    const participants: AttendanceParticipant[] = [];
    let pageToken = "";
    for (let page = 0; page < 5; page += 1) {
      const url = `${MEET}/${conferenceRecordName}/participants?pageSize=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) break;
      const data = (await res.json().catch(() => ({}))) as {
        participants?: Array<{ earliestStartTime?: string; latestEndTime?: string; signedinUser?: { user?: string } }>;
        nextPageToken?: string;
      };
      for (const p of data.participants || []) {
        const email = await resolveParticipantEmail(accessToken, p.signedinUser?.user);
        participants.push({ email, startTime: p.earliestStartTime || new Date(0).toISOString(), endTime: p.latestEndTime || null });
      }
      pageToken = data.nextPageToken || "";
      if (!pageToken) break;
    }
    return participants;
  } catch {
    return null;
  }
}

export async function getZoomAttendance(accessToken: string, meetingId: string): Promise<AttendanceParticipant[] | null> {
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

export async function getTeamsAttendance(accessToken: string, meetingId: string): Promise<AttendanceParticipant[] | null> {
  try {
    const listRes = await fetch(`${GRAPH}/me/onlineMeetings/${encodeURIComponent(meetingId)}/attendanceReports`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) return null;
    const listData = (await listRes.json().catch(() => ({}))) as { value?: Array<{ id?: string }> };
    const reportId = listData.value?.[listData.value.length - 1]?.id;
    if (!reportId) return null;

    const recordsRes = await fetch(
      `${GRAPH}/me/onlineMeetings/${encodeURIComponent(meetingId)}/attendanceReports/${encodeURIComponent(reportId)}/attendanceRecords`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!recordsRes.ok) return null;
    const recordsData = (await recordsRes.json().catch(() => ({}))) as {
      value?: Array<{ emailAddress?: string; attendanceIntervals?: Array<{ joinDateTime?: string; leaveDateTime?: string }> }>;
    };

    const participants: AttendanceParticipant[] = [];
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

const MIN_HELD_SECONDS_DEFAULT = 5 * 60;

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, (end - start) / 1000);
}

export function computeAttendance(opts: {
  inviteeEmail: string;
  participants: AttendanceParticipant[];
  meetingStartIso: string;
  meetingEndIso: string;
  minHeldSeconds?: number;
}): { held: boolean; attendeeCount: number; durationSeconds: number } {
  const invitee = opts.inviteeEmail.trim().toLowerCase();
  const windowStart = new Date(opts.meetingStartIso).getTime();
  const windowEnd = new Date(opts.meetingEndIso).getTime() + 2 * 60 * 60 * 1000;
  const minHeldSeconds = opts.minHeldSeconds ?? MIN_HELD_SECONDS_DEFAULT;

  const distinctEmails = new Set<string>();
  let inviteeSeconds = 0;
  for (const p of opts.participants) {
    if (p.email) distinctEmails.add(p.email.toLowerCase());
    if (!p.email || p.email.toLowerCase() !== invitee) continue;
    const sessionStart = new Date(p.startTime).getTime();
    const sessionEnd = p.endTime ? new Date(p.endTime).getTime() : windowEnd;
    if (!Number.isFinite(sessionStart)) continue;
    inviteeSeconds += overlapSeconds(sessionStart, sessionEnd, windowStart, windowEnd);
  }

  return {
    held: inviteeSeconds >= minHeldSeconds,
    attendeeCount: distinctEmails.size,
    durationSeconds: Math.round(inviteeSeconds),
  };
}
