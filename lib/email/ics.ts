/**
 * Minimal RFC 5545 (iCalendar) support for meeting-invite cards in the email reader.
 *
 * Hand-rolled to match this repo's existing convention (lib/calendar/googleCalendar.ts's
 * buildIcs()) rather than adding an ICS library dependency. Scope is deliberately narrow: read
 * the first VEVENT out of an inbound invite, and build a REPLY back to the organizer. Full
 * RFC 5545 (multi-VEVENT calendars, VALARM, VTIMEZONE-qualified DTSTART, etc.) is out of scope.
 */

export type ParsedInvite = {
  uid: string;
  method: string;
  sequence: number;
  summary: string;
  description: string;
  location: string;
  startIso: string;
  endIso: string;
  isAllDay: boolean;
  organizerEmail: string;
  attendeeEmails: string[];
  hasRrule: boolean;
};

/** Undo RFC 5545 line folding: a continuation line starts with a single space or tab. */
function unfold(icsText: string): string[] {
  const rawLines = icsText.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function splitProperty(line: string): { name: string; params: Record<string, string>; value: string } {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return { name: line, params: {}, value: "" };
  const head = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Parses `YYYYMMDD` or `YYYYMMDDTHHMMSS[Z]` into an ISO string. Bare (no Z / no TZID) is treated as UTC — a
 * simplification that can be off by the organizer's UTC offset for non-UTC, non-floating times; acceptable for
 * a display card, not for exact-time calendaring. */
function parseIcsDateTime(value: string, params: Record<string, string>): { iso: string; isAllDay: boolean } {
  const isAllDay = params.VALUE === "DATE" || /^\d{8}$/.test(value);
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return { iso: new Date(0).toISOString(), isAllDay };
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
  return { iso: new Date(iso).toISOString(), isAllDay };
}

function extractEmail(value: string): string {
  const m = value.match(/mailto:([^;\s]+)/i);
  return (m ? m[1] : value).trim().toLowerCase();
}

/** Parses the first VEVENT out of an inbound calendar part. Returns null if there's no VEVENT, or no UID/DTSTART. */
export function parseIcsCalendar(icsText: string): ParsedInvite | null {
  const lines = unfold(icsText);
  let calendarMethod = "";
  let inEvent = false;
  let hasRrule = false;
  const event: Record<string, string> = {};
  const attendeeEmails: string[] = [];
  let startParsed: { iso: string; isAllDay: boolean } | null = null;
  let endParsed: { iso: string; isAllDay: boolean } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === "BEGIN:VEVENT") {
      if (inEvent) break; // Only the first VEVENT — see file-level scope note.
      inEvent = true;
      continue;
    }
    if (line === "END:VEVENT") break;
    const { name, params, value } = splitProperty(line);
    if (!inEvent) {
      if (name === "METHOD") calendarMethod = value.trim().toUpperCase();
      continue;
    }
    switch (name) {
      case "UID":
        event.uid = value.trim();
        break;
      case "SEQUENCE":
        event.sequence = value.trim();
        break;
      case "SUMMARY":
        event.summary = unescapeText(value);
        break;
      case "DESCRIPTION":
        event.description = unescapeText(value);
        break;
      case "LOCATION":
        event.location = unescapeText(value);
        break;
      case "DTSTART":
        startParsed = parseIcsDateTime(value.trim(), params);
        break;
      case "DTEND":
        endParsed = parseIcsDateTime(value.trim(), params);
        break;
      case "ORGANIZER":
        event.organizer = extractEmail(value);
        break;
      case "ATTENDEE": {
        const email = extractEmail(value);
        if (email) attendeeEmails.push(email);
        break;
      }
      case "RRULE":
        hasRrule = true;
        break;
      default:
        break;
    }
  }

  if (!event.uid || !startParsed) return null;

  return {
    uid: event.uid,
    method: calendarMethod || "PUBLISH",
    sequence: Number(event.sequence || 0) || 0,
    summary: event.summary || "(No title)",
    description: event.description || "",
    location: event.location || "",
    startIso: startParsed.iso,
    endIso: (endParsed || startParsed).iso,
    isAllDay: startParsed.isAllDay,
    organizerEmail: event.organizer || "",
    attendeeEmails,
    hasRrule,
  };
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export type IcsPartstat = "ACCEPTED" | "DECLINED" | "TENTATIVE";

/**
 * Builds a standards-compliant iTIP REPLY — what Gmail/Outlook's own Yes/No/Maybe buttons send
 * under the hood. Must echo the original invite's UID and SEQUENCE so the organizer's calendar
 * matches this reply to the right event (and the right version of it, if it was rescheduled).
 */
export function buildIcsReply(opts: {
  uid: string;
  sequence: number;
  summary: string;
  startIso: string;
  endIso: string;
  organizerEmail: string;
  attendeeEmail: string;
  partstat: IcsPartstat;
}): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vierra//EmailReader//EN",
    "METHOD:REPLY",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `SEQUENCE:${opts.sequence}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(opts.startIso)}`,
    `DTEND:${icsDate(opts.endIso)}`,
    `SUMMARY:${opts.summary.replace(/[\r\n]/g, " ")}`,
    `ORGANIZER:mailto:${opts.organizerEmail}`,
    `ATTENDEE;PARTSTAT=${opts.partstat};RSVP=FALSE:mailto:${opts.attendeeEmail}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
