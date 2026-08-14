import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { BusyInterval } from "@/lib/calendar/googleCalendar";

// teamAvailability talks to prisma, the token store, and the Google Calendar FreeBusy API.
// Mock all three so we can exercise the pure availability logic (interval intersection,
// soft-fallback for uncheckable members, per-slot overlap, ordering) with no network/DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    companyMembership: { findMany: vi.fn() },
    platformToken: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/gmail/tokens", () => ({ getValidGmailAccessToken: vi.fn() }));
vi.mock("@/lib/calendar/googleCalendar", () => ({ getBusy: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getBusy } from "@/lib/calendar/googleCalendar";
import { getTeamBusyIntersection, findFreeCompanyMembers } from "@/lib/booking/teamAvailability";

/** Build an ISO interval on 2026-01-01 from whole-hour boundaries, e.g. iv(10, 11). */
const iv = (startHour: number, endHour: number): BusyInterval => ({
  start: new Date(Date.UTC(2026, 0, 1, startHour)).toISOString(),
  end: new Date(Date.UTC(2026, 0, 1, endHour)).toISOString(),
});

type MemberConfig = { email: string | null; token?: "ok" | "bad"; busy?: BusyInterval[] };

// Loosely-typed mock handles — Prisma's overloaded query signatures don't accept a plain
// mockImplementation, so we treat these as generic mocks for wiring.
const membershipFindMany = prisma.companyMembership.findMany as unknown as Mock;
const platformFindFirst = prisma.platformToken.findFirst as unknown as Mock;
const tokenFor = getValidGmailAccessToken as unknown as Mock;
const busyFor = getBusy as unknown as Mock;

/**
 * Wire the mocks for a set of members. Each member maps to whether it has a connected calendar
 * (email), whether its token is valid, and what busy intervals its calendar returns.
 */
function setup(memberIds: string[], config: Record<string, MemberConfig>) {
  membershipFindMany.mockResolvedValue(memberIds.map((user_id) => ({ user_id })));
  platformFindFirst.mockImplementation((args: { where: { user_id: string } }) => {
    const email = config[args.where.user_id]?.email;
    return Promise.resolve(email ? { platform: `gmail:${email}` } : null);
  });
  tokenFor.mockImplementation((userId: string) =>
    Promise.resolve(
      config[userId]?.token === "bad"
        ? { ok: false, reason: "refresh_failed", message: "bad token" }
        : { ok: true, accessToken: `tok-${userId}` }
    )
  );
  // getBusy is called with the access token; our tokens encode the userId so we can map back.
  busyFor.mockImplementation((accessToken: string) =>
    Promise.resolve(config[accessToken.replace(/^tok-/, "")]?.busy ?? [])
  );
}

beforeEach(() => vi.clearAllMocks());

describe("getTeamBusyIntersection", () => {
  it("returns the overlap when every member is busy at the same time", async () => {
    setup(["a", "b"], { a: { email: "a@x.com", busy: [iv(10, 11)] }, b: { email: "b@x.com", busy: [iv(10, 11)] } });
    expect(await getTeamBusyIntersection("co", iv(9, 17).start, iv(9, 17).end)).toEqual([iv(10, 11)]);
  });

  it("returns nothing when members are busy at disjoint times (someone is always free)", async () => {
    setup(["a", "b"], { a: { email: "a@x.com", busy: [iv(10, 11)] }, b: { email: "b@x.com", busy: [iv(12, 13)] } });
    expect(await getTeamBusyIntersection("co", iv(9, 17).start, iv(9, 17).end)).toEqual([]);
  });

  it("returns only the intersecting portion of partially-overlapping busy blocks", async () => {
    setup(["a", "b"], { a: { email: "a@x.com", busy: [iv(10, 12)] }, b: { email: "b@x.com", busy: [iv(11, 13)] } });
    expect(await getTeamBusyIntersection("co", iv(9, 17).start, iv(9, 17).end)).toEqual([iv(11, 12)]);
  });

  it("excludes members with no connected calendar from the intersection (soft-fallback)", async () => {
    // Only 'a' is checkable; 'b' has no calendar and must not block a slot.
    setup(["a", "b"], { a: { email: "a@x.com", busy: [iv(10, 11)] }, b: { email: null } });
    expect(await getTeamBusyIntersection("co", iv(9, 17).start, iv(9, 17).end)).toEqual([iv(10, 11)]);
  });

  it("excludes members whose token is invalid", async () => {
    setup(["a", "b"], { a: { email: "a@x.com", busy: [iv(10, 11)] }, b: { email: "b@x.com", token: "bad", busy: [iv(10, 11)] } });
    // Only 'a' counts, so the intersection is just a's busy block.
    expect(await getTeamBusyIntersection("co", iv(9, 17).start, iv(9, 17).end)).toEqual([iv(10, 11)]);
  });

  it("never blocks any slot when nobody's calendar is checkable", async () => {
    setup(["a", "b"], { a: { email: null }, b: { email: "b@x.com", token: "bad" } });
    expect(await getTeamBusyIntersection("co", iv(9, 17).start, iv(9, 17).end)).toEqual([]);
  });

  it("returns [] for a company with no members", async () => {
    setup([], {});
    expect(await getTeamBusyIntersection("co", iv(9, 17).start, iv(9, 17).end)).toEqual([]);
  });
});

describe("findFreeCompanyMembers", () => {
  it("returns members free at the slot and drops members busy then", async () => {
    setup(["a", "b"], { a: { email: "a@x.com", busy: [] }, b: { email: "b@x.com", busy: [iv(10, 11)] } });
    expect(await findFreeCompanyMembers("co", iv(10, 11).start, iv(10, 11).end)).toEqual(["a"]);
  });

  it("treats members without a calendar or with a bad token as free (soft-fallback)", async () => {
    setup(["a", "b"], { a: { email: null }, b: { email: "b@x.com", token: "bad" } });
    expect(await findFreeCompanyMembers("co", iv(10, 11).start, iv(10, 11).end)).toEqual(["a", "b"]);
  });

  it("preserves member order in the returned free-list", async () => {
    setup(["a", "b", "c"], {
      a: { email: "a@x.com", busy: [] },
      b: { email: "b@x.com", busy: [iv(10, 11)] }, // busy -> excluded
      c: { email: "c@x.com", busy: [] },
    });
    expect(await findFreeCompanyMembers("co", iv(10, 11).start, iv(10, 11).end)).toEqual(["a", "c"]);
  });

  it("does not count an adjacent (non-overlapping) busy block as a conflict", async () => {
    // Slot 10-11; member busy 11-12 starts exactly at the slot end — no overlap, so still free.
    setup(["a"], { a: { email: "a@x.com", busy: [iv(11, 12)] } });
    expect(await findFreeCompanyMembers("co", iv(10, 11).start, iv(10, 11).end)).toEqual(["a"]);
  });

  it("counts a partially-overlapping busy block as a conflict", async () => {
    // Slot 10-11; member busy 10:30-11:30 overlaps -> not free.
    const half = {
      start: new Date(Date.UTC(2026, 0, 1, 10, 30)).toISOString(),
      end: new Date(Date.UTC(2026, 0, 1, 11, 30)).toISOString(),
    };
    setup(["a"], { a: { email: "a@x.com", busy: [half] } });
    expect(await findFreeCompanyMembers("co", iv(10, 11).start, iv(10, 11).end)).toEqual([]);
  });
});
