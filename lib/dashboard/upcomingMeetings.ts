import { prisma } from "@/lib/prisma"
import { getValidGmailAccessToken } from "@/lib/gmail/tokens"
import { getCalendarVisibilityPreferences } from "@/lib/googleCalendar/visibility"

type GoogleCalendarListResponse = {
  items?: Array<{
    id?: string
    summary?: string
    selected?: boolean
    hidden?: boolean
    accessRole?: string
    timeZone?: string
  }>
}

type GoogleCalendarEventsResponse = {
  items?: Array<{
    id?: string
    summary?: string
    start?: { dateTime?: string; date?: string; timeZone?: string }
    end?: { dateTime?: string; date?: string; timeZone?: string }
    location?: string
    description?: string
    htmlLink?: string
    hangoutLink?: string
    organizer?: { email?: string; displayName?: string }
    attendees?: Array<{ email?: string; displayName?: string }>
    conferenceData?: {
      entryPoints?: Array<{ uri?: string; entryPointType?: string }>
    }
  }>
}

type GoogleCalendarEvent = NonNullable<GoogleCalendarEventsResponse["items"]>[number]

export type UpcomingMeeting = {
  id: string
  title: string
  organizer: string
  startIso: string
  endIso: string | null
  timeZone: string
  meetingLink: string
}

export type IssueCode = "none" | "permission" | "api_disabled" | "google_error" | "no_calendars"

export type UpcomingMeetingsResult = {
  connected: boolean
  connectedEmail: string | null
  needsReconnect: boolean
  issueCode: IssueCode
  issueMessage: string
  meetings: UpcomingMeeting[]
}

type GoogleApiErrorPayload = {
  error?: {
    message?: string
    status?: string
    code?: number
    errors?: Array<{ reason?: string; message?: string }>
  }
}

async function parseGoogleError(response: Response) {
  const payload = (await response.json().catch(() => null)) as GoogleApiErrorPayload | null
  const reason = payload?.error?.errors?.[0]?.reason || ""
  const status = payload?.error?.status || ""
  const message = payload?.error?.message || ""
  return { reason, status, message }
}

function canReadCalendar(accessRole: string | undefined) {
  if (!accessRole) return false
  return ["freeBusyReader", "reader", "writer", "owner"].includes(accessRole)
}

function toDateStart(start?: { dateTime?: string; date?: string }) {
  if (!start) return null
  if (start.dateTime) return new Date(start.dateTime)
  if (start.date) return new Date(`${start.date}T00:00:00Z`)
  return null
}

function firstUrlFromText(value?: string | null) {
  if (!value) return null
  const match = value.match(/https?:\/\/[^\s)]+/i)
  return match ? match[0] : null
}

function resolveMeetingLink(event: GoogleCalendarEvent) {
  const locationUrl = firstUrlFromText(event.location)
  if (locationUrl) return locationUrl
  const googleMeetUrl =
    event.conferenceData?.entryPoints?.find((entry) => entry.uri && entry.entryPointType === "video")?.uri ||
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((entry) => entry.uri)?.uri
  if (googleMeetUrl) return googleMeetUrl
  const descriptionUrl = firstUrlFromText(event.description)
  if (descriptionUrl) return descriptionUrl
  return null
}

/**
 * Hits the live Google Calendar API for every Gmail account this user has connected. This is
 * the expensive part (a calendarList + events call per connected calendar) — callers should
 * only invoke this from the background sync job (see syncUpcomingMeetingsForUser below), not
 * from a request a user is waiting on. The one exception is a just-connected account with no
 * cache row yet (see pages/api/dashboard/upcoming-meetings.ts), which is a one-time cost.
 */
export async function fetchUpcomingMeetingsFromGoogle(userId: string): Promise<UpcomingMeetingsResult> {
  const tokenRows = await prisma.platformToken.findMany({
    where: { user_id: userId, platform: { startsWith: "gmail:" } },
    select: { platform: true },
    orderBy: { created_at: "desc" },
  })

  if (!tokenRows.length) {
    return { connected: false, connectedEmail: null, needsReconnect: false, issueCode: "none", issueMessage: "", meetings: [] }
  }

  const tokenResults = await Promise.all(
    tokenRows.map(async (row) => {
      const email = row.platform.replace(/^gmail:/, "")
      const tokenResult = await getValidGmailAccessToken(userId, email)
      return tokenResult.ok ? { email, accessToken: tokenResult.accessToken } : null
    })
  )
  const validConnections = tokenResults.filter(
    (c): c is { email: string; accessToken: string } => c !== null
  )

  if (!validConnections.length) {
    return { connected: false, connectedEmail: null, needsReconnect: false, issueCode: "none", issueMessage: "", meetings: [] }
  }

  const nowIso = new Date().toISOString()
  const visibilityRows = await getCalendarVisibilityPreferences(userId)
  const visibilityMap = new Map(visibilityRows.map((row) => [`${row.accountEmail}::${row.calendarId}`, row.isEnabled]))
  let needsReconnect = false
  let issueCode: IssueCode = "none"
  let issueMessage = ""
  const eventsByAccount = await Promise.all(
    validConnections.map(async (connection) => {
      const calendarListRes = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?showHidden=false&showDeleted=false",
        {
          headers: { Authorization: `Bearer ${connection.accessToken}` },
        }
      )

      if (!calendarListRes.ok) {
        const parsed = await parseGoogleError(calendarListRes)
        const isApiDisabled =
          parsed.reason === "accessNotConfigured" || parsed.status === "PERMISSION_DENIED"
        const isPermissionIssue =
          calendarListRes.status === 401 ||
          parsed.reason === "insufficientPermissions" ||
          parsed.status === "PERMISSION_DENIED"

        if (isPermissionIssue) {
          needsReconnect = true
        }
        if (isApiDisabled) {
          issueCode = "api_disabled"
          issueMessage =
            "Google Calendar API is disabled for your Google OAuth project. Enable Calendar API in Google Cloud Console."
        } else if (isPermissionIssue) {
          issueCode = "permission"
          issueMessage =
            "Google account needs calendar permission. Reconnect account and grant calendar access."
        } else {
          issueCode = "google_error"
          issueMessage = parsed.message || "Google Calendar request failed."
        }
        return []
      }
      const calendarListJson = (await calendarListRes.json()) as GoogleCalendarListResponse
      const visibleCalendars = (calendarListJson.items || []).filter(
        (calendar) => {
          if (!calendar.id || calendar.hidden || !canReadCalendar(calendar.accessRole)) return false
          const key = `${connection.email}::${calendar.id}`
          return visibilityMap.get(key) ?? true
        }
      )
      if (!visibleCalendars.length) {
        if (issueCode === "none") {
          issueCode = "no_calendars"
          issueMessage = ""
        }
        return []
      }

      const eventsByCalendar = await Promise.all(
        visibleCalendars.map(async (calendar) => {
          const eventsRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
              calendar.id as string
            )}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(nowIso)}&maxResults=25`,
            {
              headers: { Authorization: `Bearer ${connection.accessToken}` },
            }
          )

          if (!eventsRes.ok) {
            const parsed = await parseGoogleError(eventsRes)
            const isApiDisabled =
              parsed.reason === "accessNotConfigured" || parsed.status === "PERMISSION_DENIED"
            const isPermissionIssue =
              eventsRes.status === 401 ||
              parsed.reason === "insufficientPermissions" ||
              parsed.status === "PERMISSION_DENIED"

            if (isPermissionIssue) {
              needsReconnect = true
            }
            if (isApiDisabled) {
              issueCode = "api_disabled"
              issueMessage =
                "Google Calendar API is disabled for your Google OAuth project. Enable Calendar API in Google Cloud Console."
            } else if (isPermissionIssue) {
              issueCode = "permission"
              issueMessage =
                "Google account needs calendar permission. Reconnect account and grant calendar access."
            } else if (issueCode === "none") {
              issueCode = "google_error"
              issueMessage = parsed.message || "Google Calendar events request failed."
            }
            return []
          }
          const eventsJson = (await eventsRes.json()) as GoogleCalendarEventsResponse
          return (eventsJson.items || []).map((event) => ({
            event,
            calendarTimeZone: calendar.timeZone || "UTC",
            fallbackOrganizer: connection.email,
          }))
        })
      )

      return eventsByCalendar.flat()
    })
  )

  const mergedMeetings = eventsByAccount
    .flat()
    .map(({ event, calendarTimeZone, fallbackOrganizer }) => {
      const eventStart = toDateStart(event.start)
      if (!eventStart || Number.isNaN(eventStart.getTime())) return null
      const eventEnd = toDateStart(event.end)

      const meetingLink = resolveMeetingLink(event)
      if (!meetingLink) return null

      return {
        id: event.id || `${eventStart.toISOString()}-${event.summary || "event"}`,
        title: event.summary || "Untitled Meeting",
        organizer: event.organizer?.email || event.organizer?.displayName || fallbackOrganizer || "Organizer",
        startIso: eventStart.toISOString(),
        endIso: eventEnd && !Number.isNaN(eventEnd.getTime()) ? eventEnd.toISOString() : null,
        timeZone: event.start?.timeZone || calendarTimeZone || "UTC",
        meetingLink,
      }
    })
    .filter((meeting): meeting is UpcomingMeeting => Boolean(meeting))
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime())
    .slice(0, 3)

  return {
    connected: true,
    connectedEmail: validConnections[0].email,
    needsReconnect: needsReconnect && mergedMeetings.length === 0,
    issueCode: mergedMeetings.length === 0 ? issueCode : "none",
    issueMessage: mergedMeetings.length === 0 ? issueMessage : "",
    meetings: mergedMeetings,
  }
}

/**
 * Refreshes the DB-cached upcoming meetings + sync status for one user. Called by the cron
 * dispatch endpoint (see pages/api/dashboard/meetings-sync/dispatch.ts) on a schedule, and as
 * a one-time fallback by the GET endpoint the first time a user is read before any cron tick
 * has synced them yet (e.g. right after connecting Gmail).
 */
export async function syncUpcomingMeetingsForUser(userId: string): Promise<UpcomingMeetingsResult> {
  const result = await fetchUpcomingMeetingsFromGoogle(userId)

  await prisma.$transaction([
    prisma.dashboardUpcomingMeeting.deleteMany({ where: { user_id: userId } }),
    ...(result.meetings.length
      ? [
          prisma.dashboardUpcomingMeeting.createMany({
            data: result.meetings.map((meeting) => ({
              user_id: userId,
              event_id: meeting.id,
              title: meeting.title,
              organizer: meeting.organizer,
              start_at: new Date(meeting.startIso),
              end_at: meeting.endIso ? new Date(meeting.endIso) : null,
              time_zone: meeting.timeZone,
              meeting_link: meeting.meetingLink,
            })),
          }),
        ]
      : []),
    prisma.dashboardMeetingsSyncStatus.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        connected: result.connected,
        connected_email: result.connectedEmail,
        needs_reconnect: result.needsReconnect,
        issue_code: result.issueCode,
        issue_message: result.issueMessage,
      },
      update: {
        connected: result.connected,
        connected_email: result.connectedEmail,
        needs_reconnect: result.needsReconnect,
        issue_code: result.issueCode,
        issue_message: result.issueMessage,
        synced_at: new Date(),
      },
    }),
  ])

  return result
}

/** Reads the DB cache written by syncUpcomingMeetingsForUser — no Google API calls. */
export async function readCachedUpcomingMeetings(userId: string): Promise<UpcomingMeetingsResult | null> {
  const status = await prisma.dashboardMeetingsSyncStatus.findUnique({ where: { user_id: userId } })
  if (!status) return null

  const meetings = await prisma.dashboardUpcomingMeeting.findMany({
    where: { user_id: userId },
    orderBy: { start_at: "asc" },
    take: 3,
  })

  return {
    connected: status.connected,
    connectedEmail: status.connected_email,
    needsReconnect: status.needs_reconnect,
    issueCode: status.issue_code as IssueCode,
    issueMessage: status.issue_message || "",
    meetings: meetings.map((m) => ({
      id: m.event_id,
      title: m.title,
      organizer: m.organizer,
      startIso: m.start_at.toISOString(),
      endIso: m.end_at ? m.end_at.toISOString() : null,
      timeZone: m.time_zone,
      meetingLink: m.meeting_link,
    })),
  }
}
