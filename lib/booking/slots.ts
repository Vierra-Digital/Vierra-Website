import type { BusyInterval } from "@/lib/calendar/googleCalendar";

/**
 * Availability window for a booking link. Hours are minutes-from-midnight in UTC for v1
 * (slots are unambiguous UTC instants; the public page shows them in the invitee's local
 * time). Timezone-aware host windows are a later refinement.
 */
export type Availability = {
  days: number[]; // 0=Sun … 6=Sat (UTC)
  startMinutes: number; // e.g. 14*60 = 14:00 UTC
  endMinutes: number; // e.g. 22*60 = 22:00 UTC
};

export const DEFAULT_AVAILABILITY: Availability = { days: [1, 2, 3, 4, 5], startMinutes: 14 * 60, endMinutes: 22 * 60 };

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
  max?: number;
}): string[] {
  const { availability, durationMinutes, bufferMinutes, busy, rangeStart, rangeEnd, nowMs } = opts;
  const durMs = durationMinutes * 60 * 1000;
  const bufMs = bufferMinutes * 60 * 1000;
  const max = opts.max ?? 200;
  const slots: string[] = [];

  const day = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate()));
  while (day.getTime() <= rangeEnd.getTime() && slots.length < max) {
    if (availability.days.includes(day.getUTCDay())) {
      for (let m = availability.startMinutes; m + durationMinutes <= availability.endMinutes; m += durationMinutes) {
        const startMs = day.getTime() + m * 60 * 1000;
        const endMs = startMs + durMs;
        if (startMs <= nowMs) continue;
        if (startMs > rangeEnd.getTime()) break;
        if (overlapsBusy(startMs, endMs, busy, bufMs)) continue;
        slots.push(new Date(startMs).toISOString());
        if (slots.length >= max) break;
      }
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return slots;
}
