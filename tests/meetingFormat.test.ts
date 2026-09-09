import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMeetingDate, formatMeetingTimeRange, isMeetingToday, resolveLocalTimeZone } from "@/lib/meetingFormat";

const NOW = new Date("2026-06-15T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isMeetingToday / formatMeetingDate", () => {
  it("recognizes a same-day meeting as today", () => {
    expect(isMeetingToday("2026-06-15T18:00:00.000Z", "UTC")).toBe(true);
    expect(formatMeetingDate("2026-06-15T18:00:00.000Z", "UTC")).toBe("Today");
  });

  it("recognizes the next calendar day as tomorrow, not today", () => {
    expect(isMeetingToday("2026-06-16T01:00:00.000Z", "UTC")).toBe(false);
    expect(formatMeetingDate("2026-06-16T01:00:00.000Z", "UTC")).toBe("Tomorrow");
  });

  it("falls back to a plain date for anything further out", () => {
    expect(formatMeetingDate("2026-06-20T01:00:00.000Z", "UTC")).toBe("06/20/2026");
  });

  it("evaluates 'today' against the given time zone, not just UTC", () => {
    // NOW is 2026-06-15T12:00Z: still June 15 in UTC, but already June 16 local in Auckland
    // (UTC+12). A meeting at 2026-06-15T11:00Z is June 15 in both zones for the meeting itself,
    // but only matches "today" where the viewer's own current day is also June 15.
    expect(isMeetingToday("2026-06-15T11:00:00.000Z", "UTC")).toBe(true);
    expect(isMeetingToday("2026-06-15T11:00:00.000Z", "Pacific/Auckland")).toBe(false);
  });
});

describe("formatMeetingTimeRange", () => {
  it("renders a start-end range with the zone abbreviation", () => {
    const range = formatMeetingTimeRange("2026-06-15T14:00:00.000Z", "2026-06-15T14:30:00.000Z", "UTC");
    expect(range).toContain("2:00");
    expect(range).toContain("2:30");
  });

  it("renders just the start time when there is no end", () => {
    const range = formatMeetingTimeRange("2026-06-15T14:00:00.000Z", null, "UTC");
    expect(range).toContain("2:00");
    expect(range).not.toContain("-");
  });
});

describe("resolveLocalTimeZone", () => {
  it("returns a non-empty IANA zone string", () => {
    expect(typeof resolveLocalTimeZone()).toBe("string");
    expect(resolveLocalTimeZone().length).toBeGreaterThan(0);
  });
});
