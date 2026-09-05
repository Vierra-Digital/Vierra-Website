import { describe, it, expect } from "vitest";
import { parseIcsCalendar, buildIcsReply } from "@/lib/email/ics";

function ics(lines: string[]) {
  return lines.join("\r\n");
}

describe("parseIcsCalendar", () => {
  it("parses a plain REQUEST invite", () => {
    const invite = parseIcsCalendar(
      ics([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        "UID:abc-123",
        "SEQUENCE:0",
        "SUMMARY:Weekly Sync",
        "DESCRIPTION:Catch up on the roadmap",
        "LOCATION:Zoom",
        "DTSTART:20260310T170000Z",
        "DTEND:20260310T173000Z",
        "ORGANIZER:mailto:organizer@example.com",
        "ATTENDEE:mailto:attendee@example.com",
        "END:VEVENT",
        "END:VCALENDAR",
      ])
    );
    expect(invite).toEqual({
      uid: "abc-123",
      method: "REQUEST",
      sequence: 0,
      summary: "Weekly Sync",
      description: "Catch up on the roadmap",
      location: "Zoom",
      startIso: "2026-03-10T17:00:00.000Z",
      endIso: "2026-03-10T17:30:00.000Z",
      isAllDay: false,
      organizerEmail: "organizer@example.com",
      attendeeEmails: ["attendee@example.com"],
      hasRrule: false,
    });
  });

  it("marks CANCEL invites with the right method", () => {
    const invite = parseIcsCalendar(
      ics([
        "BEGIN:VCALENDAR",
        "METHOD:CANCEL",
        "BEGIN:VEVENT",
        "UID:cancel-1",
        "DTSTART:20260310T170000Z",
        "END:VEVENT",
        "END:VCALENDAR",
      ])
    );
    expect(invite?.method).toBe("CANCEL");
  });

  it("treats a DATE-only DTSTART as all-day", () => {
    const invite = parseIcsCalendar(
      ics([
        "BEGIN:VCALENDAR",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        "UID:allday-1",
        "SUMMARY:Company Holiday",
        "DTSTART;VALUE=DATE:20260704",
        "DTEND;VALUE=DATE:20260705",
        "END:VEVENT",
        "END:VCALENDAR",
      ])
    );
    expect(invite?.isAllDay).toBe(true);
    expect(invite?.startIso).toBe("2026-07-04T00:00:00.000Z");
  });

  it("unfolds a line-folded SUMMARY", () => {
    const invite = parseIcsCalendar(
      ics([
        "BEGIN:VCALENDAR",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        "UID:folded-1",
        "SUMMARY:Quarterly Planning ",
        " and Roadmap Review",
        "DTSTART:20260310T170000Z",
        "END:VEVENT",
        "END:VCALENDAR",
      ])
    );
    expect(invite?.summary).toBe("Quarterly Planning and Roadmap Review");
  });

  it("flags a recurring invite via RRULE", () => {
    const invite = parseIcsCalendar(
      ics([
        "BEGIN:VCALENDAR",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        "UID:recurring-1",
        "DTSTART:20260310T170000Z",
        "RRULE:FREQ=WEEKLY;BYDAY=TU",
        "END:VEVENT",
        "END:VCALENDAR",
      ])
    );
    expect(invite?.hasRrule).toBe(true);
  });

  it("returns null when there's no VEVENT", () => {
    expect(parseIcsCalendar(ics(["BEGIN:VCALENDAR", "VERSION:2.0", "END:VCALENDAR"]))).toBeNull();
  });

  it("returns null when the VEVENT has no UID", () => {
    expect(
      parseIcsCalendar(
        ics(["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART:20260310T170000Z", "END:VEVENT", "END:VCALENDAR"])
      )
    ).toBeNull();
  });
});

describe("buildIcsReply", () => {
  it("echoes UID/SEQUENCE and sets PARTSTAT for the attendee", () => {
    const reply = buildIcsReply({
      uid: "abc-123",
      sequence: 2,
      summary: "Weekly Sync",
      startIso: "2026-03-10T17:00:00.000Z",
      endIso: "2026-03-10T17:30:00.000Z",
      organizerEmail: "organizer@example.com",
      attendeeEmail: "attendee@example.com",
      partstat: "ACCEPTED",
    });
    expect(reply).toContain("METHOD:REPLY");
    expect(reply).toContain("UID:abc-123");
    expect(reply).toContain("SEQUENCE:2");
    expect(reply).toContain("ATTENDEE;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:attendee@example.com");
    expect(reply).toContain("ORGANIZER:mailto:organizer@example.com");
  });
});
