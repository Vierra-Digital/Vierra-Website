import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platformTokenFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { platformToken: { findMany: (...args: unknown[]) => platformTokenFindMany(...args) } },
}));

import { getBusy, resolveVisibleCalendarIds } from "@/lib/calendar/googleCalendar";

describe("getBusy", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests every given calendar id and unions their busy blocks", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        calendars: {
          primary: { busy: [{ start: "2026-01-05T10:00:00Z", end: "2026-01-05T11:00:00Z" }] },
          "team@vierradev.com": { busy: [{ start: "2026-01-05T14:00:00Z", end: "2026-01-05T15:00:00Z" }] },
        },
      }),
    });

    const busy = await getBusy("token", "2026-01-05T00:00:00Z", "2026-01-06T00:00:00Z", ["primary", "team@vierradev.com"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items).toEqual([{ id: "primary" }, { id: "team@vierradev.com" }]);
    expect(busy).toEqual([
      { start: "2026-01-05T10:00:00Z", end: "2026-01-05T11:00:00Z" },
      { start: "2026-01-05T14:00:00Z", end: "2026-01-05T15:00:00Z" },
    ]);
  });

  it("defaults to just primary when no calendar ids are given", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ calendars: { primary: { busy: [] } } }) });
    await getBusy("token", "2026-01-05T00:00:00Z", "2026-01-06T00:00:00Z");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items).toEqual([{ id: "primary" }]);
  });

  it("returns null (not []) on a non-ok response — a failed check must not read as 'free'", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" });
    expect(await getBusy("token", "2026-01-05T00:00:00Z", "2026-01-06T00:00:00Z")).toBeNull();
  });

  it("returns null when the response has no calendars object at all", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await getBusy("token", "2026-01-05T00:00:00Z", "2026-01-06T00:00:00Z")).toBeNull();
  });

  it("treats a calendar id missing from the response as simply having no busy blocks", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ calendars: { primary: { busy: [] } } }) });
    const busy = await getBusy("token", "2026-01-05T00:00:00Z", "2026-01-06T00:00:00Z", ["primary", "missing@x.com"]);
    expect(busy).toEqual([]);
  });
});

describe("resolveVisibleCalendarIds", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    platformTokenFindMany.mockReset();
    platformTokenFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes the primary calendar by default even with no stored preferences at all", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: "host@vierradev.com", primary: true, accessRole: "owner" }] }),
    });
    const ids = await resolveVisibleCalendarIds("user-1", "host@vierradev.com", "token");
    expect(ids).toEqual(["host@vierradev.com"]);
  });

  it("excludes Google's generated holiday calendars", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: "host@vierradev.com", primary: true, accessRole: "owner" },
          { id: "en.usa#holiday@group.v.calendar.google.com", accessRole: "reader" },
        ],
      }),
    });
    const ids = await resolveVisibleCalendarIds("user-1", "host@vierradev.com", "token");
    expect(ids).toEqual(["host@vierradev.com"]);
  });

  it("excludes a non-primary calendar the host has not opted into (default-off)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: "host@vierradev.com", primary: true, accessRole: "owner" },
          { id: "someone-elses-calendar@group.calendar.google.com", accessRole: "reader" },
        ],
      }),
    });
    const ids = await resolveVisibleCalendarIds("user-1", "host@vierradev.com", "token");
    expect(ids).toEqual(["host@vierradev.com"]);
  });

  it("includes a non-primary calendar the host explicitly enabled via a stored preference", async () => {
    platformTokenFindMany.mockResolvedValue([
      {
        platform: `gcalvis:${encodeURIComponent("host@vierradev.com")}::${encodeURIComponent("shared@group.calendar.google.com")}`,
        access_token: "__enabled__",
      },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: "host@vierradev.com", primary: true, accessRole: "owner" },
          { id: "shared@group.calendar.google.com", accessRole: "reader" },
        ],
      }),
    });
    const ids = await resolveVisibleCalendarIds("user-1", "host@vierradev.com", "token");
    expect(ids.sort()).toEqual(["host@vierradev.com", "shared@group.calendar.google.com"].sort());
  });

  it("excludes a hidden calendar and one the host lacks read access to", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: "host@vierradev.com", primary: true, accessRole: "owner" },
          { id: "hidden@group.calendar.google.com", hidden: true, accessRole: "owner" },
          { id: "no-access@group.calendar.google.com", accessRole: "none" },
        ],
      }),
    });
    const ids = await resolveVisibleCalendarIds("user-1", "host@vierradev.com", "token");
    expect(ids).toEqual(["host@vierradev.com"]);
  });

  it("falls back to just primary when the calendar list request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    expect(await resolveVisibleCalendarIds("user-1", "host@vierradev.com", "token")).toEqual(["primary"]);
  });

  it("falls back to just primary if fetch itself throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    expect(await resolveVisibleCalendarIds("user-1", "host@vierradev.com", "token")).toEqual(["primary"]);
  });
});
