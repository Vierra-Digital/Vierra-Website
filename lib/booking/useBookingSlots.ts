import { useEffect, useMemo, useRef, useState } from "react";

export type SlotsResponse = { title: string; description: string | null; durationMinutes: number; slots: string[] };

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** Common IANA zones offered in the timezone picker — detected zone is prepended, deduped. */
export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

/** The viewer's browser-detected IANA timezone, falling back to UTC if unavailable. */
export function detectBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "YYYY-MM-DD" for `d` as a wall-clock date IN `timeZone` — the calendar-day bucket an instant falls into for that viewer. */
function dayKeyInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Renders an instant in `timeZone` (defaults to the browser's own zone). The booking API's
 * `when` string is formatted in the host's timezone (BookingLink.timezone) instead, for
 * host-facing emails — echoing that one back as an on-screen "you're booked" confirmation
 * showed a different clock time than the one the visitor just picked. Format the same instant
 * here instead so the picker and the confirmation always agree, and so switching the viewer's
 * timezone selector relabels both consistently.
 */
export function formatLocalDateTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  const abbrev = timeZoneAbbrev(date, timeZone);
  return `${date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", timeZone })} at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone })}${abbrev ? ` ${abbrev}` : ""}`;
}

/** Short timezone label (e.g. "PDT", "GMT+2") for `timeZone` (default: viewer's own) at `date`. */
export function timeZoneAbbrev(date: Date = new Date(), timeZone?: string): string {
  try {
    const parts = new Intl.DateTimeFormat([], { timeZoneName: "short", timeZone }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

/** UTC instant formatted as Google Calendar's compact date param (YYYYMMDDTHHmmssZ). */
function toGCalUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * "Add to Google Calendar" link for a booking — a same-tab backup for a visitor whose invite
 * email is slow, filtered, or missed, built entirely client-side (no extra request).
 */
export function googleCalendarAddUrl(confirmation: Pick<BookingConfirmation, "startIso" | "durationMinutes" | "title" | "joinUrl">): string {
  const start = new Date(confirmation.startIso);
  const end = new Date(start.getTime() + confirmation.durationMinutes * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: confirmation.title,
    dates: `${toGCalUtc(start)}/${toGCalUtc(end)}`,
  });
  if (confirmation.joinUrl) params.set("details", `Join: ${confirmation.joinUrl}`);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Fetches a booking link's open slots and drives the month calendar / day-time-picker
 * state shared by the standalone booking page (pages/book/[slug].tsx) and any in-modal
 * booking step. No JSX — see components/booking/SlotCalendar.tsx for the rendered grid.
 */
export function useBookingSlots(slug: string, daysAhead: number = 60, timezone: string = detectBrowserTimeZone()) {
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [viewMonth, setViewMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string>("");
  // Bumped to re-run the fetch effect below on demand (e.g. after a 409 "slot taken" so the
  // picker drops the now-stale slot instead of leaving the visitor to retry a dead time).
  const [refetchNonce, setRefetchNonce] = useState(0);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    // Request the max window (default endpoint window is only 14 days) so the calendar's
    // month navigation has more than a couple weeks of real data to page through.
    fetch(`/api/booking/${encodeURIComponent(slug)}/slots?days=${daysAhead}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SlotsResponse) => setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, daysAhead, refetchNonce]);

  // Also drops the current selection — it's the stale/conflicting slot a caller just failed to
  // book, so it shouldn't still read as "selected" once fresh slots come back without it.
  const refetch = () => {
    setSelected("");
    setRefetchNonce((n) => n + 1);
  };

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const iso of data?.slots || []) {
      const key = dayKeyInTz(new Date(iso), timezone);
      const arr = groups.get(key) || [];
      arr.push(iso);
      groups.set(key, arr);
    }
    return groups;
  }, [data, timezone]);

  // Default to the first day/month that actually has open slots, once they load. Guarded on
  // viewMonth (not selectedDay) so this only ever runs once: goToMonth intentionally clears
  // selectedDay when paging between months, and keying this off selectedDay meant that clearing
  // it re-armed this effect, which then snapped viewMonth straight back to the first month —
  // i.e. every month-navigation click silently undid itself on the next render.
  useEffect(() => {
    if (viewMonth || slotsByDay.size === 0) return;
    const firstKey = [...slotsByDay.keys()].sort()[0];
    const [y, m, d] = firstKey.split("-").map(Number);
    setSelectedDay(firstKey);
    setViewMonth(new Date(y, m - 1, d));
  }, [slotsByDay, viewMonth]);

  // Switching the viewer's timezone can shift which calendar day an instant falls into (an
  // extreme case: booking-page-selected Tokyo vs. Los_Angeles can disagree on the date for the
  // same slot), so the previously anchored day/month may no longer line up with the new
  // slotsByDay grouping. Re-anchor directly to the (possibly relabeled) day/month rather than
  // nulling viewMonth/selectedDay first and letting the effect above re-derive them a render
  // later — that round trip briefly rendered an empty calendar/day panel on every timezone
  // switch. Skipped on mount (prevTimezone starts equal to timezone) so it doesn't fight that
  // effect's own initial anchor.
  const prevTimezoneRef = useRef(timezone);
  useEffect(() => {
    if (prevTimezoneRef.current === timezone) return;
    prevTimezoneRef.current = timezone;
    if (slotsByDay.size === 0) {
      setViewMonth(null);
      setSelectedDay("");
      return;
    }
    // Keep showing the same calendar day if it still has slots under the new timezone
    // (the common case — a switch only relabels the times shown, not which day they fall
    // on); only re-anchor to the first available day if it doesn't.
    const preferredKey = selectedDay && slotsByDay.has(selectedDay) ? selectedDay : [...slotsByDay.keys()].sort()[0];
    const [y, m, d] = preferredKey.split("-").map(Number);
    setSelectedDay(preferredKey);
    setViewMonth(new Date(y, m - 1, d));
  }, [timezone, slotsByDay, selectedDay]);

  // Bounded by the actual fetched window (today .. today+daysAhead), not by which months
  // happen to contain an open slot — a month with zero open slots (fully booked, or outside
  // the host's availability days) should still be reachable, just showing an empty grid,
  // rather than making "next month" look broken.
  const monthRange = useMemo(() => {
    const [y, m, d] = dayKeyInTz(new Date(), timezone).split("-").map(Number);
    const now = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + daysAhead);
    return { min: new Date(now.getFullYear(), now.getMonth(), 1), max: new Date(end.getFullYear(), end.getMonth(), 1) };
  }, [daysAhead, timezone]);

  const calendarWeeks = useMemo(() => {
    if (!viewMonth) return [];
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = new Date(year, month, 1).getDay();
    const cells: (Date | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [viewMonth]);

  const todayKey = dayKeyInTz(new Date(), timezone);
  const canGoPrevMonth = Boolean(viewMonth && monthKey(viewMonth) > monthKey(monthRange.min));
  const canGoNextMonth = Boolean(viewMonth && monthKey(viewMonth) < monthKey(monthRange.max));

  const goToMonth = (offset: number) => {
    if (!viewMonth) return;
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1));
    // The previously selected day may not even be visible in the new month — clear it so the
    // right-hand panel doesn't keep showing times for a day that's no longer on screen.
    setSelectedDay("");
  };

  const dayTimes = selectedDay ? slotsByDay.get(selectedDay) || [] : [];
  const selectedDayLabel = selectedDay
    ? (() => {
        // selectedDay is a plain "YYYY-MM-DD" bucket (already computed in `timezone` above) —
        // anchor it at UTC noon and format with timeZone: "UTC" so this is pure calendar-date
        // labeling with no further timezone reinterpretation (parsing it back through the
        // system's own local timezone here, via `new Date(\`${selectedDay}T00:00:00\`)`, would
        // silently relabel it wrong whenever the viewer's chosen timezone differs from the
        // machine's actual one).
        const [y, m, d] = selectedDay.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
      })()
    : "Pick a day";

  return {
    data,
    loading,
    notFound,
    refetch,
    timezone,
    slotsByDay,
    selectedDay,
    setSelectedDay,
    viewMonth,
    selected,
    setSelected,
    monthRange,
    calendarWeeks,
    todayKey,
    canGoPrevMonth,
    canGoNextMonth,
    goToMonth,
    dayTimes,
    selectedDayLabel,
    weekdayLabels: WEEKDAY_LABELS,
  };
}

/**
 * Everything an on-screen "you're booked" success view needs — the display string plus enough
 * raw data (startIso, durationMinutes, title) to build an "Add to calendar" link, and the
 * booking id for a self-service manage/reschedule/cancel link (pages/manage/[id].tsx).
 */
export type BookingConfirmation = {
  when: string;
  startIso: string;
  durationMinutes: number;
  title: string;
  id: string;
  joinUrl: string | null;
};

export type BookSlotArgs = {
  slug: string;
  start: string;
  inviteeName: string;
  inviteeEmail: string;
  notes?: string;
  ref?: string;
};

export type BookSlotResult = {
  when: string;
  /** Booking id — powers the self-service manage/reschedule/cancel link (pages/manage/[id].tsx). */
  id: string;
  /** Meet/Zoom/Teams join link, if the calendar event was created with one. */
  joinUrl: string | null;
};

/** Thrown by bookSlot on a 409 — the slot was taken (by someone else, or a stale/cached picker). */
export class BookingConflictError extends Error {}

/** POSTs a slot booking. Shared by the standalone /book page and any in-modal booking step. */
export async function bookSlot({ slug, start, inviteeName, inviteeEmail, notes, ref }: BookSlotArgs): Promise<BookSlotResult> {
  const res = await fetch(`/api/booking/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, inviteeName, inviteeEmail, notes: notes || "", ref: ref || "" }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload?.message || "Could not book that time.";
    if (res.status === 409) throw new BookingConflictError(message);
    throw new Error(message);
  }
  return { when: payload?.when || "your selected time", id: payload?.id || "", joinUrl: payload?.joinUrl ?? null };
}
