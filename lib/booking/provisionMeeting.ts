import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { createCalendarEvent } from "@/lib/calendar/googleCalendar";
import { getValidZoomAccessTokenForUser } from "@/lib/zoom/tokens";
import { getValidMsTeamsAccessTokenForUser } from "@/lib/msteams/tokens";
import { createZoomMeeting } from "@/lib/calendar/zoomMeetings";
import { createTeamsMeeting } from "@/lib/calendar/msTeamsMeetings";

export type ProvisionedMeeting = { googleEventId: string | null; providerMeetingId: string | null; joinUrl: string | null };

/**
 * Create the real meeting (Zoom/Teams via provider API, or let Google Meet auto-provision) plus
 * the Google Calendar event for free/busy + invite — under a SPECIFIC host's own tokens. Shared
 * by the solo booking flow (pages/api/booking/[id]/index.ts) and the team claim/auto-assign
 * paths (Phase 3), which provision under whichever host ends up claiming the slot, not
 * necessarily the link's creator.
 */
export async function provisionBookingMeeting(opts: {
  hostUserId: string;
  hostGmailAccountEmail: string;
  provider: string;
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  timezone: string;
  durationMinutes: number;
  attendeeEmails: string[];
}): Promise<ProvisionedMeeting> {
  let providerMeeting: { meetingId: string; joinUrl: string | null } | null = null;

  if (opts.provider === "zoom") {
    const zoomToken = await getValidZoomAccessTokenForUser(opts.hostUserId);
    if (zoomToken.ok) {
      providerMeeting = await createZoomMeeting(zoomToken.accessToken, {
        topic: opts.summary,
        startIso: opts.startIso,
        durationMinutes: opts.durationMinutes,
        timezone: opts.timezone,
      });
    }
  } else if (opts.provider === "microsoft_teams") {
    const teamsToken = await getValidMsTeamsAccessTokenForUser(opts.hostUserId);
    if (teamsToken.ok) {
      providerMeeting = await createTeamsMeeting(teamsToken.accessToken, {
        subject: opts.summary,
        startIso: opts.startIso,
        endIso: opts.endIso,
      });
    }
  }

  const gmailToken = await getValidGmailAccessToken(opts.hostUserId, opts.hostGmailAccountEmail);
  const created = gmailToken.ok
    ? await createCalendarEvent(gmailToken.accessToken, {
        summary: opts.summary,
        description: opts.description,
        startIso: opts.startIso,
        endIso: opts.endIso,
        timezone: opts.timezone,
        attendees: [...opts.attendeeEmails, opts.hostGmailAccountEmail],
        createConferenceLink: opts.provider === "google_meet",
        location: providerMeeting?.joinUrl || undefined,
      })
    : null;

  return {
    googleEventId: created?.eventId || null,
    providerMeetingId: providerMeeting?.meetingId ?? created?.meetingCode ?? null,
    joinUrl: providerMeeting?.joinUrl ?? created?.joinUrl ?? null,
  };
}
