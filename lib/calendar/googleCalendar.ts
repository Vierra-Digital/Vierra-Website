/**
 * Google Calendar helpers for the meeting booker. Uses the same OAuth token as Gmail
 * (calendar.readonly grants free/busy; calendar.events is needed to create events —
 * accounts without it fall back to an emailed .ics invite).
 */
const CAL = "https://www.googleapis.com/calendar/v3";

export type BusyInterval = { start: string; end: string };

/**
 * Query the host's primary calendar for busy intervals in a window. Returns `null` (not `[]`)
 * on any failure — a non-OK response, a network error, or a malformed body — so a caller can
 * tell "the host has no meetings" apart from "we couldn't ask Google." Collapsing those into the
 * same `[]` used to make a failed lookup show the host as completely free, letting a visitor
 * book straight over a real meeting.
 */
export async function getBusy(accessToken: string, timeMin: string, timeMax: string): Promise<BusyInterval[] | null> {
  try {
    const res = await fetch(`${CAL}/freeBusy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
    });
    if (!res.ok) {
      // Was previously swallowed into a bare `[]`, which is indistinguishable from "genuinely no
      // meetings" — logged now so a real cause (expired scope, rate limit, transient 5xx) shows
      // up instead of just a fail-closed 502 with nothing to diagnose it from.
      console.error(`[getBusy] freeBusy ${res.status}: ${(await res.text().catch(() => "")).slice(0, 500)}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as { calendars?: { primary?: { busy?: BusyInterval[] } } } | null;
    const busy = data?.calendars?.primary?.busy;
    if (!Array.isArray(busy)) console.error(`[getBusy] unexpected freeBusy response shape: ${JSON.stringify(data).slice(0, 500)}`);
    return Array.isArray(busy) ? busy : null;
  } catch (err) {
    console.error(`[getBusy] freeBusy request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// Google's freeBusy endpoint 400s ("timeRangeTooLong") once timeMin..timeMax spans roughly 3
// months — confirmed empirically (90 days: ok, 120 days: rejected). A booking link with a wide
// window (e.g. the audit-call link's 365-day "unbounded" horizon) needs its range split into
// chunks under that cap; 80 days leaves margin under the ~92-day boundary for month-length drift.
const MAX_FREEBUSY_RANGE_DAYS = 80;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Like `getBusy`, but transparently splits a `timeMin..timeMax` range wider than Google's
 * freeBusy cap into multiple chunked requests (run in parallel) and merges the results. Use this
 * instead of `getBusy` directly whenever the range isn't already known to be short — a plain
 * `getBusy` call over 120+ days doesn't return partial data, it fails the whole request.
 */
export async function getBusyOverRange(accessToken: string, timeMin: string, timeMax: string): Promise<BusyInterval[] | null> {
  const startMs = new Date(timeMin).getTime();
  const endMs = new Date(timeMax).getTime();
  const spanDays = (endMs - startMs) / MS_PER_DAY;
  if (spanDays <= MAX_FREEBUSY_RANGE_DAYS) return getBusy(accessToken, timeMin, timeMax);

  const chunkMs = MAX_FREEBUSY_RANGE_DAYS * MS_PER_DAY;
  const requests: Promise<BusyInterval[] | null>[] = [];
  for (let chunkStart = startMs; chunkStart < endMs; chunkStart += chunkMs) {
    const chunkEnd = Math.min(chunkStart + chunkMs, endMs);
    requests.push(getBusy(accessToken, new Date(chunkStart).toISOString(), new Date(chunkEnd).toISOString()));
  }
  const results = await Promise.all(requests);
  if (results.some((r) => r === null)) return null;
  return results.flat() as BusyInterval[];
}

export type CreatedCalendarEvent = {
  eventId: string;
  /** Google Meet join URL, if conferenceData provisioning succeeded. */
  joinUrl: string | null;
  /** The Meet space's short meeting code (e.g. "abc-defg-hij") — used to look up attendance via lib/calendar/googleMeet.ts. Null for non-Meet conferencing or if provisioning failed. */
  meetingCode: string | null;
};

/**
 * Create an event on the host's primary calendar (with a Meet link). Returns the event id
 * plus the Meet join URL/code, or null if the account lacks calendar.events scope (403) —
 * the caller then sends an .ics.
 */
export async function createCalendarEvent(
  accessToken: string,
  opts: {
    summary: string;
    description: string;
    startIso: string;
    endIso: string;
    timezone: string;
    attendees: string[];
    /** Request Google Meet auto-provisioning. Off when the booking uses Zoom/Teams instead (Phase 2) — the real join link is passed via `location` in that case. */
    createConferenceLink?: boolean;
    location?: string;
  }
): Promise<CreatedCalendarEvent | null> {
  const wantsConference = opts.createConferenceLink !== false;
  try {
    const res = await fetch(
      `${CAL}/calendars/primary/events?sendUpdates=all${wantsConference ? "&conferenceDataVersion=1" : ""}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: opts.summary,
          description: opts.description,
          location: opts.location,
          start: { dateTime: opts.startIso, timeZone: opts.timezone },
          end: { dateTime: opts.endIso, timeZone: opts.timezone },
          attendees: opts.attendees.map((email) => ({ email })),
          ...(wantsConference ? { conferenceData: { createRequest: { requestId: `vierra-${opts.startIso}` } } } : {}),
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      hangoutLink?: string;
      conferenceData?: { conferenceId?: string; entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
    };
    if (typeof data?.id !== "string") return null;
    const videoEntry = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
    return {
      eventId: data.id,
      joinUrl: data.hangoutLink || videoEntry?.uri || null,
      meetingCode: data.conferenceData?.conferenceId || null,
    };
  } catch {
    return null;
  }
}

/** Cancel a previously-created event (used on booking cancel/reassign). Best-effort — never throws. */
export async function cancelCalendarEvent(accessToken: string, eventId: string): Promise<boolean> {
  try {
    const res = await fetch(`${CAL}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok || res.status === 410; // 410 Gone = already deleted
  } catch {
    return false;
  }
}

function icsDate(iso: string): string {
  // YYYYMMDDTHHMMSSZ (UTC)
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Build a minimal VCALENDAR invite so recipients can add the meeting even without a Calendar event. */
export function buildIcs(opts: { uid: string; summary: string; description: string; startIso: string; endIso: string; organizerEmail: string; attendeeEmail: string }): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vierra//Booking//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(opts.startIso)}`,
    `DTEND:${icsDate(opts.endIso)}`,
    `SUMMARY:${opts.summary.replace(/[\r\n]/g, " ")}`,
    `DESCRIPTION:${opts.description.replace(/[\r\n]/g, " ")}`,
    `ORGANIZER:mailto:${opts.organizerEmail}`,
    `ATTENDEE;RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
