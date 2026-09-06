import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { parseScheduledAt } from "@/lib/gmail/scheduledSend";
import { hashIp, resolveExpiry } from "@/lib/email/confidential";

/**
 * Two time-and-secret helpers that sit on request boundaries: what /api/gmail/send will accept as
 * a schedule, and when a confidential message stops being readable. Both are pure and both are
 * the kind of arithmetic where an off-by-one is invisible until someone's mail goes out at the
 * wrong moment.
 *
 * Every expectation here was read off the running code first, not assumed.
 */

const NOW = new Date("2026-06-01T12:00:00.000Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * 60 * 1000;

/** An ISO string `ms` from NOW. */
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe("parseScheduledAt — what it refuses", () => {
  it("refuses an absent schedule", () => {
    for (const raw of [null, undefined, ""]) {
      const r = parseScheduledAt(raw, NOW);
      expect(r.ok, String(raw)).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/no schedule time/i);
    }
  });

  it("refuses something that is not a date", () => {
    for (const raw of ["next tuesday", "tomorrow", "13:00", "not-a-date", {}, []]) {
      const r = parseScheduledAt(raw, NOW);
      expect(r.ok, JSON.stringify(raw)).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/invalid schedule time/i);
    }
  });

  it("refuses the past, with the same message as too-soon", () => {
    const r = parseScheduledAt("2020-01-01T00:00:00.000Z", NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/at least a minute in the future/i);
  });
});

describe("parseScheduledAt — the boundaries", () => {
  it("refuses exactly one minute out, and accepts a millisecond past it", () => {
    // The guard is `<=`, so the boundary itself is refused. That is deliberate: a send scheduled
    // for exactly now+60s would race the dispatch tick.
    expect(parseScheduledAt(at(MINUTE), NOW).ok).toBe(false);
    expect(parseScheduledAt(at(MINUTE + 1), NOW).ok).toBe(true);
  });

  it("accepts exactly sixty days out, and refuses a millisecond past it", () => {
    // Here the guard is `>`, so this boundary is inclusive — the opposite of the one above.
    expect(parseScheduledAt(at(60 * DAY), NOW).ok).toBe(true);
    const tooFar = parseScheduledAt(at(60 * DAY + 1), NOW);
    expect(tooFar.ok).toBe(false);
    if (!tooFar.ok) expect(tooFar.message).toMatch(/at most 60 days/i);
  });

  it("returns the exact instant it was given, not a rounded one", () => {
    const r = parseScheduledAt(at(90 * MINUTE), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date.toISOString()).toBe(at(90 * MINUTE));
  });
});

describe("parseScheduledAt — the input shapes callers actually send", () => {
  it("accepts an ISO string with a zone, which is what the panel sends", () => {
    // The compose UI reads a datetime-local value and does new Date(v).toISOString() in the
    // browser, so the user's local time is already converted to UTC before it arrives.
    expect(parseScheduledAt(at(2 * MINUTE), NOW).ok).toBe(true);
  });

  it("accepts an epoch as a number", () => {
    const r = parseScheduledAt(NOW.getTime() + 2 * MINUTE, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date.getTime()).toBe(NOW.getTime() + 2 * MINUTE);
  });

  it("does NOT accept the same epoch as a string", () => {
    // Documented rather than desired: String(raw) goes to new Date(), which reads a digit string
    // as a date rather than a timestamp. A caller sending the number as text gets "Invalid
    // schedule time" and no hint why, so send a number or an ISO string.
    const r = parseScheduledAt(String(NOW.getTime() + 2 * MINUTE), NOW);
    expect(r.ok).toBe(false);
  });

  it("reads a string with no zone as the server's local time", () => {
    // Also documented rather than desired. It does not bite today because the browser converts
    // before sending; it would bite a caller that forwarded a datetime-local value verbatim.
    const local = "2026-06-01T13:00:00";
    const r = parseScheduledAt(local, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Whatever the runner's zone is, the parse must agree with the platform's own reading of
      // the same string — the point is that no zone means local, not UTC.
      expect(r.date.getTime()).toBe(new Date(local).getTime());
    }
  });

  it("accepts a Date instance, since String(date) round-trips", () => {
    const r = parseScheduledAt(new Date(NOW.getTime() + 2 * MINUTE), NOW);
    expect(r.ok).toBe(true);
  });

  it("judges against the `now` it is handed, not the wall clock", () => {
    // The route passes new Date(); the tests pass a fixed instant. A schedule that is valid
    // relative to one `now` must be invalid relative to a later one.
    const iso = at(30 * MINUTE);
    expect(parseScheduledAt(iso, NOW).ok).toBe(true);
    expect(parseScheduledAt(iso, new Date(NOW.getTime() + 40 * MINUTE)).ok).toBe(false);
  });
});

describe("resolveExpiry", () => {
  it("offsets from the instant it is given", () => {
    expect(resolveExpiry("1d", NOW)?.toISOString()).toBe(at(DAY));
    expect(resolveExpiry("1w", NOW)?.toISOString()).toBe(at(7 * DAY));
    // "1 month" is 30 days here, not a calendar month.
    expect(resolveExpiry("1m", NOW)?.toISOString()).toBe(at(30 * DAY));
  });

  it("gives null for no expiry", () => {
    // null is what the column stores for "never", so this must not become a far-future date.
    expect(resolveExpiry("never", NOW)).toBeNull();
  });

  it("gives null when the option is missing or unrecognised", () => {
    expect(resolveExpiry(undefined, NOW)).toBeNull();
    // A typo must not silently become a short expiry — a link that dies early looks like a bug
    // to the recipient, and one that never dies is the caller's explicit choice.
    expect(resolveExpiry("1y" as never, NOW)).toBeNull();
    expect(resolveExpiry("" as never, NOW)).toBeNull();
  });

  it("does not mutate the `now` it was passed", () => {
    const now = new Date(NOW);
    resolveExpiry("1w", now);
    expect(now.toISOString()).toBe(NOW.toISOString());
  });
});

describe("hashIp", () => {
  it("is deterministic and 32 hex characters", () => {
    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
    expect(hashIp("203.0.113.7")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("separates addresses that differ by one digit", () => {
    expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
  });

  it("is salted, so a table of plain IP hashes does not reverse it", () => {
    // The viewer log stores this instead of the address. An unsalted sha256 of an IPv4 address is
    // trivially reversible — there are only four billion of them.
    const bare = createHash("sha256").update("203.0.113.7").digest("hex").slice(0, 32);
    expect(hashIp("203.0.113.7")).not.toBe(bare);
  });

  it("handles an empty or unusual address without throwing", () => {
    for (const ip of ["", "::1", "2001:db8::1", "unknown"]) {
      expect(hashIp(ip), ip).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(hashIp("")).not.toBe(hashIp("::1"));
  });
});
