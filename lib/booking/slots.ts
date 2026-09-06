import type { BusyInterval } from "@/lib/calendar/googleCalendar";

/**
 * Availability window for a booking link. Hours are minutes-from-midnight and `days` are
 * weekday indices (0=Sun … 6=Sat) interpreted in the HOST's timezone (BookingLink.timezone).
 * Slots are emitted as unambiguous UTC instants; the public page shows them in the invitee's
 * local time. Timezone conversion is DST-correct (via Intl), so "Mon 09:00–17:00
 * America/New_York" lands on the right UTC instants across the DST boundary.
 */
export type Availability = {
  days: number[]; // 0=Sun … 6=Sat (host-local) — a day with no `perDay` entry uses this default window
  startMinutes: number; // e.g. 9*60 = 09:00 host-local
  endMinutes: number; // e.g. 17*60 = 17:00 host-local
  /**
   * Optional per-weekday override, for hosts whose hours actually differ by day (e.g. shorter
   * weekend hours) rather than being uniform across every day in `days`. Keys are weekday
   * indices from `days`; a day present here uses its own start/end instead of the top-level
   * default. Omitting this (or a given day within it) keeps the old single-window behavior, so
   * existing links' stored JSON needs no migration.
   */
  perDay?: Partial<Record<number, { startMinutes: number; endMinutes: number }>>;
};

export const DEFAULT_AVAILABILITY: Availability = { days: [1, 2, 3, 4, 5], startMinutes: 14 * 60, endMinutes: 22 * 60 };

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock parts of an instant, as seen in `timeZone`. */
function tzParts(date: Date, timeZone: string): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return map;
}

/** Offset (timeZone − UTC) in ms at the given instant. */
function offsetMs(date: Date, timeZone: string): number {
  const m = tzParts(date, timeZone);
  const asUtc = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  return asUtc - date.getTime();
}

/** Convert a host-local wall-clock time to the corresponding UTC instant (DST-correct). */
function wallToUtc(year: number, month: number, day: number, minutes: number, timeZone: string): Date {
  const asUtc = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  // Two passes: refine the offset using the first estimate so DST transitions resolve correctly.
  let off = offsetMs(new Date(asUtc), timeZone);
  off = offsetMs(new Date(asUtc - off), timeZone);
  return new Date(asUtc - off);
}

function localYMD(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const m = tzParts(date, timeZone);
  return { year: +m.year, month: +m.month, day: +m.day };
}

/** Advance a plain (year, month, day) calendar tuple by one day. */
function nextDay(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function localWeekday(year: number, month: number, day: number, timeZone: string): number {
  const noon = wallToUtc(year, month, day, 12 * 60, timeZone);
  const wd = tzParts(noon, timeZone).weekday;
  return WEEKDAY_INDEX[wd] ?? noon.getUTCDay();
}

function overlapsBusy(startMs: number, endMs: number, busy: BusyInterval[], bufferMs: number): boolean {
  for (const b of busy) {
    const bs = new Date(b.start).getTime() - bufferMs;
    const be = new Date(b.end).getTime() + bufferMs;
    if (startMs < be && endMs > bs) return true;
  }
  return false;
}

/** Generate available slot start times (ISO, UTC) within [rangeStart, rangeEnd]. */
export function computeSlots(opts: {
  availability: Availability;
  durationMinutes: number;
  bufferMinutes: number;
  busy: BusyInterval[];
  rangeStart: Date;
  rangeEnd: Date;
  nowMs: number;
  /** IANA timezone the availability window is expressed in. Defaults to UTC. */
  timeZone?: string;
  max?: number;
}): string[] {
  const { availability, durationMinutes, bufferMinutes, busy, rangeStart, rangeEnd, nowMs } = opts;
  const timeZone = opts.timeZone || "UTC";
  const durMs = durationMinutes * 60 * 1000;
  const bufMs = bufferMinutes * 60 * 1000;
  const max = opts.max ?? 200;
  const rangeEndMs = rangeEnd.getTime();
  const slots: string[] = [];

  // Iterate host-local calendar days (start one day early so a window already open in the
  // host tz at rangeStart isn't skipped), stopping once slots pass the end of the range.
  let { year, month, day } = localYMD(new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000), timeZone);

  // Safety backstop, not the real terminator — the loop already exits via the rangeEnd check
  // below once a local day starts past the window. Sized off the actual requested range (plus
  // slack) instead of a fixed guess so a long window (e.g. an "unbounded" booking link's ~2-year
  // horizon) can't get silently truncated by an unrelated hardcoded day count.
  const maxIterations = Math.ceil((rangeEndMs - rangeStart.getTime()) / (24 * 60 * 60 * 1000)) + 3;
  for (let guard = 0; guard < maxIterations && slots.length < max; guard += 1) {
    const weekday = localWeekday(year, month, day, timeZone);
    if (availability.days.includes(weekday)) {
      const window = availability.perDay?.[weekday] ?? availability;
      // Stepping by duration alone would offer slots back-to-back whenever nothing's actually
      // booked yet — the buffer only ever kept slots away from *existing* busy blocks, never
      // from each other. Advancing by duration+buffer makes every offered start time carry its
      // own gap to the next one, matching how Google Calendar's own appointment-schedule buffer
      // behaves (reference: a 15-min/10-min-buffer schedule offers :00, :25, :50, not :00/:15/:30).
      const stepMinutes = durationMinutes + bufferMinutes;
      for (let m = window.startMinutes; m + durationMinutes <= window.endMinutes; m += stepMinutes) {
        const startMs = wallToUtc(year, month, day, m, timeZone).getTime();
        const endMs = startMs + durMs;
        if (startMs <= nowMs || startMs < rangeStart.getTime()) continue;
        if (startMs > rangeEndMs) break;
        if (overlapsBusy(startMs, endMs, busy, bufMs)) continue;
        slots.push(new Date(startMs).toISOString());
        if (slots.length >= max) break;
      }
    }
    // Stop once the start of this local day is already beyond the range.
    if (wallToUtc(year, month, day, 0, timeZone).getTime() > rangeEndMs) break;
    ({ year, month, day } = nextDay(year, month, day));
  }
  return slots;
}
