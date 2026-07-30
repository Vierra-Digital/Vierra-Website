/**
 * Google Calendar helpers for the meeting booker. Uses the same OAuth token as Gmail
 * (calendar.readonly grants free/busy; calendar.events is needed to create events —
 * accounts without it fall back to an emailed .ics invite).
 */
const CAL = "https://www.googleapis.com/calendar/v3";

export type BusyInterval = { start: string; end: string };

/** Query the host's primary calendar for busy intervals in a window. */
export async function getBusy(accessToken: string, timeMin: string, timeMax: string): Promise<BusyInterval[]> {
  try {
    const res = await fetch(`${CAL}/freeBusy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as { calendars?: { primary?: { busy?: BusyInterval[] } } };
    const busy = data?.calendars?.primary?.busy;
    return Array.isArray(busy) ? busy : [];
  } catch {
    return [];
  }
}

/**
 * Create an event on the host's primary calendar (with a Meet link). Returns the event id,
 * or null if the account lacks calendar.events scope (403) — the caller then sends an .ics.
 */
export async function createCalendarEvent(
  accessToken: string,
  opts: { summary: string; description: string; startIso: string; endIso: string; timezone: string; attendees: string[] }
): Promise<string | null> {
  try {
    const res = await fetch(`${CAL}/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: opts.summary,
        description: opts.description,
        start: { dateTime: opts.startIso, timeZone: opts.timezone },
        end: { dateTime: opts.endIso, timeZone: opts.timezone },
        attendees: opts.attendees.map((email) => ({ email })),
        conferenceData: { createRequest: { requestId: `vierra-${opts.startIso}` } },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return typeof data?.id === "string" ? data.id : null;
  } catch {
    return null;
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
