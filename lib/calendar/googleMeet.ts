/**
 * Google Meet REST API (v2) helpers — attendance reports for bookings made through the
 * meeting booker. Workspace-only: personal Gmail accounts are granted the
 * meetings.space.readonly scope (see pages/api/gmail/initiate.ts) but the API 403s for them.
 * Callers treat `null` as "no attendance data available" (Workspace gating, plan limits, or
 * the meeting hasn't ended yet), distinct from `[]` which means "ended with zero attendees."
 */
const MEET = "https://meet.googleapis.com/v2";
const PEOPLE = "https://people.googleapis.com/v1";

export type MeetParticipant = {
  /** Resolved email, if the participant was a signed-in Google user and People API resolution succeeded. */
  email: string | null;
  startTime: string;
  endTime: string | null;
};

type ConferenceRecordsResponse = { conferenceRecords?: Array<{ name?: string }> };
type ParticipantsResponse = {
  participants?: Array<{
    name?: string;
    earliestStartTime?: string;
    latestEndTime?: string;
    signedinUser?: { user?: string };
  }>;
  nextPageToken?: string;
};

/** Resolve a People API resource name (e.g. "people/123") to an email address. Best-effort. */
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

/**
 * Look up the conference record for a Meet space by its short meeting code (from
 * CreatedCalendarEvent.meetingCode) and return the participant list with join/leave times.
 * Returns null if the record can't be found (not started yet, Workspace-gated, or expired —
 * Meet only retains conference records for a limited window).
 */
export async function getMeetAttendance(accessToken: string, meetingCode: string): Promise<MeetParticipant[] | null> {
  try {
    const searchRes = await fetch(
      `${MEET}/conferenceRecords?filter=${encodeURIComponent(`space.meeting_code="${meetingCode}"`)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!searchRes.ok) return null;
    const searchData = (await searchRes.json().catch(() => ({}))) as ConferenceRecordsResponse;
    const conferenceRecordName = searchData.conferenceRecords?.[0]?.name;
    if (!conferenceRecordName) return null;

    const participants: MeetParticipant[] = [];
    let pageToken = "";
    // One page is enough for the small (host + a couple of invitees) meetings this books —
    // avoid an unbounded loop against a real API.
    for (let page = 0; page < 5; page += 1) {
      const url = `${MEET}/${conferenceRecordName}/participants?pageSize=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) break;
      const data = (await res.json().catch(() => ({}))) as ParticipantsResponse;
      for (const p of data.participants || []) {
        const email = await resolveParticipantEmail(accessToken, p.signedinUser?.user);
        participants.push({
          email,
          startTime: p.earliestStartTime || new Date(0).toISOString(),
          endTime: p.latestEndTime || null,
        });
      }
      pageToken = data.nextPageToken || "";
      if (!pageToken) break;
    }
    return participants;
  } catch {
    return null;
  }
}
