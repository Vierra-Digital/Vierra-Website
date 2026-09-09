/**
 * Shared meeting date/time formatting — used by the admin dashboard's Upcoming Meetings card and
 * the client dashboard's compact meetings widget, so "Today"/"Tomorrow" and the time-range string
 * read identically in both places. Every function takes the viewer's IANA time zone explicitly
 * rather than reading it itself, so callers can memoize `resolveLocalTimeZone()` once.
 */

export function resolveLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function isMeetingToday(iso: string, timeZone: string): boolean {
  return dayKey(new Date(iso), timeZone) === dayKey(new Date(), timeZone);
}

export function formatMeetingDate(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const now = new Date();
  const meetingDay = dayKey(date, timeZone);
  if (meetingDay === dayKey(now, timeZone)) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (meetingDay === dayKey(tomorrow, timeZone)) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { month: "2-digit", day: "2-digit", year: "numeric", timeZone }).format(date);
}

function formatMeetingTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(new Date(iso));
}

function localTimeZoneAbbreviation(iso: string, timeZone: string): string | undefined {
  return new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: "short" })
    .formatToParts(new Date(iso))
    .find((part) => part.type === "timeZoneName")?.value;
}

export function formatMeetingTimeRange(startIso: string, endIso: string | null, timeZone: string): string {
  const start = formatMeetingTime(startIso, timeZone);
  const range = endIso ? `${start} - ${formatMeetingTime(endIso, timeZone)}` : start;
  const zoneAbbreviation = localTimeZoneAbbreviation(startIso, timeZone);
  return zoneAbbreviation ? `${range} ${zoneAbbreviation}` : range;
}
