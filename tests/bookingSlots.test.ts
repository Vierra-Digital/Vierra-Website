import { describe, it, expect } from "vitest";
import { computeSlots, type Availability } from "@/lib/booking/slots";

// 2026-01-05 is a Monday; 2026-01-06 a Tuesday. nowMs sits before every test range.
const base = {
  durationMinutes: 60,
  bufferMinutes: 0,
  busy: [] as { start: string; end: string }[],
  nowMs: Date.UTC(2026, 0, 1),
  timeZone: "UTC",
};
const monday = {
  rangeStart: new Date(Date.UTC(2026, 0, 5, 0, 0)),
  rangeEnd: new Date(Date.UTC(2026, 0, 5, 23, 59, 59)),
};
const avail = (days: number[], startMinutes: number, endMinutes: number): Availability => ({ days, startMinutes, endMinutes });

describe("computeSlots", () => {
  it("emits evenly-spaced slots across an open window", () => {
    const slots = computeSlots({ ...base, ...monday, availability: avail([1], 9 * 60, 12 * 60) });
    expect(slots).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-05T10:00:00.000Z",
      "2026-01-05T11:00:00.000Z",
    ]);
  });

  it("only fits a slot when the full duration precedes the window end", () => {
    // 09:00–10:00 with 30-min slots → 09:00, 09:30 (a 10:00 start would run past the window)
    const slots = computeSlots({ ...base, ...monday, durationMinutes: 30, availability: avail([1], 9 * 60, 10 * 60) });
    expect(slots).toEqual(["2026-01-05T09:00:00.000Z", "2026-01-05T09:30:00.000Z"]);
  });

  it("excludes slots that overlap a busy interval", () => {
    const slots = computeSlots({
      ...base,
      ...monday,
      availability: avail([1], 9 * 60, 12 * 60),
      busy: [{ start: "2026-01-05T10:00:00.000Z", end: "2026-01-05T11:00:00.000Z" }],
    });
    expect(slots).toEqual(["2026-01-05T09:00:00.000Z", "2026-01-05T11:00:00.000Z"]);
  });

  it("expands busy blocking by the buffer", () => {
    const slots = computeSlots({
      ...base,
      ...monday,
      bufferMinutes: 30,
      availability: avail([1], 9 * 60, 12 * 60),
      busy: [{ start: "2026-01-05T10:00:00.000Z", end: "2026-01-05T11:00:00.000Z" }],
    });
    // A 30-min buffer around 10–11 (→ 09:30–11:30) knocks out all three hourly slots.
    expect(slots).toEqual([]);
  });

  it("never returns slots at or before now", () => {
    const slots = computeSlots({
      ...base,
      ...monday,
      nowMs: Date.UTC(2026, 0, 5, 10, 30),
      availability: avail([1], 9 * 60, 12 * 60),
    });
    expect(slots).toEqual(["2026-01-05T11:00:00.000Z"]);
  });

  it("only produces slots on configured weekdays", () => {
    // Range spans Mon–Wed, but only Tuesday (day 2) is available.
    const slots = computeSlots({
      ...base,
      availability: avail([2], 9 * 60, 10 * 60),
      rangeStart: new Date(Date.UTC(2026, 0, 5)),
      rangeEnd: new Date(Date.UTC(2026, 0, 7, 23, 59)),
    });
    expect(slots).toEqual(["2026-01-06T09:00:00.000Z"]);
  });

  it("honors the max cap", () => {
    const slots = computeSlots({ ...base, ...monday, max: 2, availability: avail([1], 9 * 60, 17 * 60) });
    expect(slots).toHaveLength(2);
  });

  it("converts host-local availability to UTC (winter, EST = UTC-5)", () => {
    // 09:00 America/New_York in January = 14:00 UTC.
    const slots = computeSlots({
      ...base,
      timeZone: "America/New_York",
      availability: avail([1], 9 * 60, 10 * 60),
      rangeStart: new Date(Date.UTC(2026, 0, 4)),
      rangeEnd: new Date(Date.UTC(2026, 0, 10)),
    });
    expect(slots).toEqual(["2026-01-05T14:00:00.000Z"]);
  });

  it("converts host-local availability to UTC across DST (summer, EDT = UTC-4)", () => {
    // 09:00 America/New_York in July = 13:00 UTC — proves the conversion is DST-correct.
    const slots = computeSlots({
      ...base,
      timeZone: "America/New_York",
      availability: avail([1], 9 * 60, 10 * 60),
      rangeStart: new Date(Date.UTC(2026, 6, 5)),
      rangeEnd: new Date(Date.UTC(2026, 6, 20)),
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.endsWith("T13:00:00.000Z"))).toBe(true);
  });
});
