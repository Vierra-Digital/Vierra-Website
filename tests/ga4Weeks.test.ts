import { describe, it, expect, vi, afterEach } from "vitest";
import {
  daysInMonth,
  weeksInMonth,
  emptyWeeklyVisits,
  bucketSessionsByWeek,
  parseGa4Month,
  isGa4Configured,
  fetchWeeklyWebsiteVisits,
} from "@/lib/ga4Client";

const row = (date: string, sessions: number) => ({
  dimensionValues: [{ value: date }],
  metricValues: [{ value: String(sessions) }],
});

describe("daysInMonth", () => {
  it("handles 31/30-day months", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
  it("handles February in common and leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
  });
});

describe("weeksInMonth", () => {
  it("gives February (28 days) 4 weeks, not a phantom 5th", () => {
    expect(weeksInMonth(2026, 2)).toBe(4);
  });
  it("gives leap February and longer months 5", () => {
    expect(weeksInMonth(2024, 2)).toBe(5); // 29 days
    expect(weeksInMonth(2026, 4)).toBe(5); // 30 days
    expect(weeksInMonth(2026, 1)).toBe(5); // 31 days
  });
});

describe("emptyWeeklyVisits", () => {
  it("is shaped to the month and zeroed", () => {
    expect(emptyWeeklyVisits(2026, 2)).toEqual([
      { week: "Week 1", visits: 0 },
      { week: "Week 2", visits: 0 },
      { week: "Week 3", visits: 0 },
      { week: "Week 4", visits: 0 },
    ]);
    expect(emptyWeeklyVisits(2026, 1)).toHaveLength(5);
  });
});

describe("bucketSessionsByWeek", () => {
  it("buckets days 1-7 into week 1 and 8-14 into week 2", () => {
    const out = bucketSessionsByWeek([row("20260105", 3), row("20260107", 2), row("20260108", 5)], 5);
    expect(out[0]).toEqual({ week: "Week 1", visits: 5 });
    expect(out[1]).toEqual({ week: "Week 2", visits: 5 });
  });

  it("returns exactly weekCount buckets", () => {
    expect(bucketSessionsByWeek([], 4)).toHaveLength(4);
    expect(bucketSessionsByWeek([], 5)).toHaveLength(5);
  });

  it("folds trailing days into the last bucket rather than overflowing", () => {
    // Feb has 4 buckets; day 28 would map to index 3 — must not create a 5th.
    const out = bucketSessionsByWeek([row("20260228", 7)], 4);
    expect(out).toHaveLength(4);
    expect(out[3].visits).toBe(7);
  });

  it("ignores rows with an unparseable date and non-numeric sessions", () => {
    const out = bucketSessionsByWeek([row("", 9), row("20260101", Number.NaN)], 5);
    expect(out.every((p) => p.visits === 0)).toBe(true);
  });

  it("never returns zero buckets even for a nonsense count", () => {
    expect(bucketSessionsByWeek([], 0)).toHaveLength(1);
  });
});

describe("parseGa4Month", () => {
  it("parses YYYY-MM and rejects junk", () => {
    expect(parseGa4Month("2026-02")).toEqual({ year: 2026, month: 2 });
    expect(parseGa4Month("2026-13")).toBeNull();
    expect(parseGa4Month("nope")).toBeNull();
    expect(parseGa4Month(undefined)).toBeNull();
  });
});

describe("GA4 configuration gate", () => {
  // Env is stubbed explicitly rather than assumed: a developer with GA4 configured in .env would
  // otherwise see these pass or fail depending on their machine, which is worse than no test.
  afterEach(() => vi.unstubAllEnvs());
  const clearGa4Env = () => {
    vi.stubEnv("GA4_PROPERTY_ID", "");
    vi.stubEnv("GA4_OAUTH_REFRESH_TOKEN", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
  };

  it("reports not configured when any required credential is missing", () => {
    clearGa4Env();
    expect(isGa4Configured()).toBe(false);
    // Property id alone is not enough — the OAuth pair is still required.
    vi.stubEnv("GA4_PROPERTY_ID", "properties/123");
    expect(isGa4Configured()).toBe(false);
  });

  it("returns a month-shaped zero series instead of calling GA4 when unconfigured", async () => {
    clearGa4Env();
    await expect(fetchWeeklyWebsiteVisits(2026, 2)).resolves.toEqual(emptyWeeklyVisits(2026, 2));
    await expect(fetchWeeklyWebsiteVisits(2026, 1)).resolves.toHaveLength(5);
  });
});
