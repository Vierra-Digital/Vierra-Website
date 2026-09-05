import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getValidGmailAccessToken } from "./gmail.ts";

// Deno port of lib/dashboard/upcomingMeetings.ts — same shape, ported to supabase-js reads
// instead of Prisma. Kept as one file since the whole thing is one cohesive unit of logic that
// only this function calls.

const STORED_MEETINGS_LIMIT = 50;
const PLATFORM_PREFIX = "gcalvis:";
const DISABLED_MARKER = "__disabled__";

type GoogleCalendarListResponse = {
  items?: Array<{ id?: string; hidden?: boolean; accessRole?: string; timeZone?: string }>;
};
type GoogleCalendarEventsResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string };
    location?: string;
    description?: string;
    hangoutLink?: string;
    organizer?: { email?: string; displayName?: string };
    conferenceData?: { entryPoints?: Array<{ uri?: string; entryPointType?: string }> };
  }>;
};
type GoogleCalendarEvent = NonNullable<GoogleCalendarEventsResponse["items"]>[number];

export type UpcomingMeeting = {
  id: string;
  title: string;
  organizer: string;
  startIso: string;
  endIso: string | null;
  timeZone: string;
  meetingLink: string | null;
};

export type IssueCode = "none" | "permission" | "api_disabled" | "google_error" | "no_calendars";

export type UpcomingMeetingsResult = {
  connected: boolean;
  connectedEmail: string | null;
  needsReconnect: boolean;
  issueCode: IssueCode;
  issueMessage: string;
  meetings: UpcomingMeeting[];
};

async function parseGoogleError(response: Response) {
  const payload = await response.json().catch(() => null) as
    | { error?: { message?: string; status?: string; errors?: Array<{ reason?: string }> } }
    | null;
  return {
    reason: payload?.error?.errors?.[0]?.reason || "",
    status: payload?.error?.status || "",
    message: payload?.error?.message || "",
  };
}

function canReadCalendar(accessRole: string | undefined) {
  return !!accessRole && ["freeBusyReader", "reader", "writer", "owner"].includes(accessRole);
}

function toDateStart(start?: { dateTime?: string; date?: string }) {
  if (!start) return null;
  if (start.dateTime) return new Date(start.dateTime);
  if (start.date) return new Date(`${start.date}T00:00:00Z`);
  return null;
}

function firstUrlFromText(value?: string | null) {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s)]+/i);
  return match ? match[0] : null;
}

function resolveMeetingLink(event: GoogleCalendarEvent) {
  return (
    firstUrlFromText(event.location) ||
    event.conferenceData?.entryPoints?.find((e) => e.uri && e.entryPointType === "video")?.uri ||
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((e) => e.uri)?.uri ||
    firstUrlFromText(event.description) ||
    null
  );
}

async function getCalendarVisibilityPreferences(supabase: SupabaseClient, userId: string) {
  const { data: rows } = await supabase
    .from("platform_tokens")
    .select("platform, access_token")
    .eq("user_id", userId)
    .like("platform", `${PLATFORM_PREFIX}%`);

  const map = new Map<string, boolean>();
  for (const row of rows || []) {
    const raw = row.platform.slice(PLATFORM_PREFIX.length);
    const [emailPart, calendarPart] = raw.split("::");
    if (!emailPart || !calendarPart) continue;
    const key = `${decodeURIComponent(emailPart).trim().toLowerCase()}::${decodeURIComponent(calendarPart)}`;
    map.set(key, row.access_token !== DISABLED_MARKER);
  }
  return map;
}

export async function fetchUpcomingMeetingsFromGoogle(
  supabase: SupabaseClient,
  userId: string
): Promise<UpcomingMeetingsResult> {
  const { data: tokenRows } = await supabase
    .from("platform_tokens")
    .select("platform")
    .eq("user_id", userId)
    .like("platform", "gmail:%")
    .order("created_at", { ascending: false });

  if (!tokenRows?.length) {
    return { connected: false, connectedEmail: null, needsReconnect: false, issueCode: "none", issueMessage: "", meetings: [] };
  }

  const tokenResults = await Promise.all(
    tokenRows.map(async (row) => {
      const email = row.platform.replace(/^gmail:/, "");
      const tokenResult = await getValidGmailAccessToken(supabase, userId, email);
      return tokenResult.ok ? { email, accessToken: tokenResult.accessToken } : null;
    })
  );
  const validConnections = tokenResults.filter((c): c is { email: string; accessToken: string } => c !== null);

  if (!validConnections.length) {
    return { connected: false, connectedEmail: null, needsReconnect: false, issueCode: "none", issueMessage: "", meetings: [] };
  }

  const nowIso = new Date().toISOString();
  const visibilityMap = await getCalendarVisibilityPreferences(supabase, userId);
  let needsReconnect = false;
  let issueCode: IssueCode = "none";
  let issueMessage = "";

  const eventsByAccount = await Promise.all(
    validConnections.map(async (connection) => {
      const calendarListRes = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?showHidden=false&showDeleted=false",
        { headers: { Authorization: `Bearer ${connection.accessToken}` } }
      );

      if (!calendarListRes.ok) {
        const parsed = await parseGoogleError(calendarListRes);
        const isApiDisabled = parsed.reason === "accessNotConfigured" || parsed.status === "PERMISSION_DENIED";
        const isPermissionIssue =
          calendarListRes.status === 401 || parsed.reason === "insufficientPermissions" || parsed.status === "PERMISSION_DENIED";
        if (isPermissionIssue) needsReconnect = true;
        if (isApiDisabled) {
          issueCode = "api_disabled";
          issueMessage = "Google Calendar API is disabled for your Google OAuth project. Enable Calendar API in Google Cloud Console.";
        } else if (isPermissionIssue) {
          issueCode = "permission";
          issueMessage = "Google account needs calendar permission. Reconnect account and grant calendar access.";
        } else {
          issueCode = "google_error";
          issueMessage = parsed.message || "Google Calendar request failed.";
        }
        return [];
      }

      const calendarListJson = (await calendarListRes.json()) as GoogleCalendarListResponse;
      const visibleCalendars = (calendarListJson.items || []).filter((calendar) => {
        if (!calendar.id || calendar.hidden || !canReadCalendar(calendar.accessRole)) return false;
        const key = `${connection.email}::${calendar.id}`;
        return visibilityMap.get(key) ?? true;
      });
      if (!visibleCalendars.length) {
        if (issueCode === "none") issueCode = "no_calendars";
        return [];
      }

      const eventsByCalendar = await Promise.all(
        visibleCalendars.map(async (calendar) => {
          const eventsRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id as string)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(nowIso)}&maxResults=25`,
            { headers: { Authorization: `Bearer ${connection.accessToken}` } }
          );
          if (!eventsRes.ok) {
            const parsed = await parseGoogleError(eventsRes);
            const isApiDisabled = parsed.reason === "accessNotConfigured" || parsed.status === "PERMISSION_DENIED";
            const isPermissionIssue =
              eventsRes.status === 401 || parsed.reason === "insufficientPermissions" || parsed.status === "PERMISSION_DENIED";
            if (isPermissionIssue) needsReconnect = true;
            if (isApiDisabled) {
              issueCode = "api_disabled";
              issueMessage = "Google Calendar API is disabled for your Google OAuth project. Enable Calendar API in Google Cloud Console.";
            } else if (isPermissionIssue) {
              issueCode = "permission";
              issueMessage = "Google account needs calendar permission. Reconnect account and grant calendar access.";
            } else if (issueCode === "none") {
              issueCode = "google_error";
              issueMessage = parsed.message || "Google Calendar events request failed.";
            }
            return [];
          }
          const eventsJson = (await eventsRes.json()) as GoogleCalendarEventsResponse;
          return (eventsJson.items || []).map((event) => ({
            event,
            calendarTimeZone: calendar.timeZone || "UTC",
            fallbackOrganizer: connection.email,
          }));
        })
      );

      return eventsByCalendar.flat();
    })
  );

  const mergedMeetings = eventsByAccount
    .flat()
    .map(({ event, calendarTimeZone, fallbackOrganizer }) => {
      const eventStart = toDateStart(event.start);
      if (!eventStart || Number.isNaN(eventStart.getTime())) return null;
      const eventEnd = toDateStart(event.end);
      return {
        id: event.id || `${eventStart.toISOString()}-${event.summary || "event"}`,
        title: event.summary || "Untitled Meeting",
        organizer: event.organizer?.email || event.organizer?.displayName || fallbackOrganizer || "Organizer",
        startIso: eventStart.toISOString(),
        endIso: eventEnd && !Number.isNaN(eventEnd.getTime()) ? eventEnd.toISOString() : null,
        timeZone: event.start?.timeZone || calendarTimeZone || "UTC",
        meetingLink: resolveMeetingLink(event),
      };
    })
    .filter((m): m is UpcomingMeeting => Boolean(m))
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime())
    .slice(0, STORED_MEETINGS_LIMIT);

  return {
    connected: true,
    connectedEmail: validConnections[0].email,
    needsReconnect: needsReconnect && mergedMeetings.length === 0,
    issueCode: mergedMeetings.length === 0 ? issueCode : "none",
    issueMessage: mergedMeetings.length === 0 ? issueMessage : "",
    meetings: mergedMeetings,
  };
}

export async function syncUpcomingMeetingsForUser(supabase: SupabaseClient, userId: string): Promise<UpcomingMeetingsResult> {
  const result = await fetchUpcomingMeetingsFromGoogle(supabase, userId);

  const seenEventIds = new Set<string>();
  const storableMeetings = result.meetings.filter((meeting) => {
    if (seenEventIds.has(meeting.id)) return false;
    seenEventIds.add(meeting.id);
    return true;
  });

  const { error } = await supabase.rpc("sync_upcoming_meetings_write", {
    p_user_id: userId,
    p_meetings: storableMeetings.map((m) => ({
      event_id: m.id,
      title: m.title,
      organizer: m.organizer,
      start_at: m.startIso,
      end_at: m.endIso,
      time_zone: m.timeZone,
      meeting_link: m.meetingLink ?? "",
    })),
    p_status: {
      connected: result.connected,
      connected_email: result.connectedEmail,
      needs_reconnect: result.needsReconnect,
      issue_code: result.issueCode,
      issue_message: result.issueMessage,
    },
  });
  if (error) throw error;

  return result;
}
