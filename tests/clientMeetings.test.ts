import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ client: { findMany: vi.fn() }, booking: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { getUpcomingMeetingsForCompany } from "@/lib/booking/clientMeetings";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getUpcomingMeetingsForCompany", () => {
  it("returns nothing without querying bookings when the company has no representatives", async () => {
    db.client.findMany.mockResolvedValue([]);
    const result = await getUpcomingMeetingsForCompany("company-1");
    expect(result).toEqual([]);
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });

  it("scopes bookings to the company's deduped, lowercased representative emails", async () => {
    db.client.findMany.mockResolvedValue([{ email: "Rep@Acme.com" }, { email: "rep@acme.com" }, { email: "second@acme.com" }]);
    db.booking.findMany.mockResolvedValue([]);
    await getUpcomingMeetingsForCompany("company-1");
    expect(db.client.findMany).toHaveBeenCalledWith({ where: { company_id: "company-1" }, select: { email: true } });
    const call = db.booking.findMany.mock.calls[0][0];
    expect(call.where.invitee_email.in.sort()).toEqual(["rep@acme.com", "second@acme.com"]);
    expect(call.where.status).toBe("confirmed");
  });

  it("maps a booking row into the client meeting shape, falling back to a default title", async () => {
    db.client.findMany.mockResolvedValue([{ email: "rep@acme.com" }]);
    db.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        start_at: new Date("2026-06-15T14:00:00.000Z"),
        end_at: new Date("2026-06-15T14:30:00.000Z"),
        meeting_join_url: "https://meet.example/xyz",
        provider: "google_meet",
        booking_links: null,
      },
    ]);
    const result = await getUpcomingMeetingsForCompany("company-1");
    expect(result).toEqual([
      {
        id: "booking-1",
        title: "Meeting with Vierra",
        startIso: "2026-06-15T14:00:00.000Z",
        endIso: "2026-06-15T14:30:00.000Z",
        timeZone: "UTC",
        meetingLink: "https://meet.example/xyz",
        provider: "google_meet",
      },
    ]);
  });

  it("prefers the booking link's own title and timezone when present", async () => {
    db.client.findMany.mockResolvedValue([{ email: "rep@acme.com" }]);
    db.booking.findMany.mockResolvedValue([
      {
        id: "booking-2",
        start_at: new Date("2026-06-15T14:00:00.000Z"),
        end_at: null,
        meeting_join_url: null,
        provider: "zoom",
        booking_links: { title: "Quarterly Review", timezone: "America/New_York" },
      },
    ]);
    const [meeting] = await getUpcomingMeetingsForCompany("company-1");
    expect(meeting.title).toBe("Quarterly Review");
    expect(meeting.timeZone).toBe("America/New_York");
    expect(meeting.meetingLink).toBeNull();
  });
});
