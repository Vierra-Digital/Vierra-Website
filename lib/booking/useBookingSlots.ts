import { useEffect, useMemo, useState } from "react";

export type SlotsResponse = { title: string; description: string | null; durationMinutes: number; slots: string[] };

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fetches a booking link's open slots and drives the month calendar / day-time-picker
 * state shared by the standalone booking page (pages/book/[slug].tsx) and any in-modal
 * booking step. No JSX — see components/booking/SlotCalendar.tsx for the rendered grid.
 */
export function useBookingSlots(slug: string, daysAhead: number = 60) {
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [viewMonth, setViewMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    // Request the max window (default endpoint window is only 14 days) so the calendar's
    // month navigation has more than a couple weeks of real data to page through.
    fetch(`/api/booking/${encodeURIComponent(slug)}/slots?days=${daysAhead}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SlotsResponse) => setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, daysAhead]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const iso of data?.slots || []) {
      const key = dayKey(new Date(iso));
      const arr = groups.get(key) || [];
      arr.push(iso);
      groups.set(key, arr);
    }
    return groups;
  }, [data]);

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

  // Bounded by the actual fetched window (today .. today+daysAhead), not by which months
  // happen to contain an open slot — a month with zero open slots (fully booked, or outside
  // the host's availability days) should still be reachable, just showing an empty grid,
  // rather than making "next month" look broken.
  const monthRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
    return { min: new Date(now.getFullYear(), now.getMonth(), 1), max: new Date(end.getFullYear(), end.getMonth(), 1) };
  }, [daysAhead]);

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

  const todayKey = dayKey(new Date());
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
    ? new Date(`${selectedDay}T00:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : "Pick a day";

  return {
    data,
    loading,
    notFound,
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

export type BookSlotArgs = {
  slug: string;
  start: string;
  inviteeName: string;
  inviteeEmail: string;
  notes?: string;
  ref?: string;
};

/** POSTs a slot booking. Shared by the standalone /book page and any in-modal booking step. */
export async function bookSlot({ slug, start, inviteeName, inviteeEmail, notes, ref }: BookSlotArgs): Promise<string> {
  const res = await fetch(`/api/booking/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, inviteeName, inviteeEmail, notes: notes || "", ref: ref || "" }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.message || "Could not book that time.");
  return payload?.when || "your selected time";
}
