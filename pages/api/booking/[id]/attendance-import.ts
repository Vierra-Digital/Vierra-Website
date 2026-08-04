import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { parseAttendanceCsv } from "@/lib/booking/csvAttendance";
import { computeAttendance } from "@/lib/booking/attendance";
import type { Prisma } from "@prisma/client";

/**
 * CSV attendance fallback for Zoom/Teams accounts whose plan/admin-consent doesn't allow the
 * automatic report API (MEETING_TRACKING_QUESTIONS.md §3/§12). Host-uploaded, native export
 * format, hard-fail on unrecognized shape — no preview/mapping UI in v1. Automatic reports
 * always take priority if they arrive later (syncBookingAttendance only overwrites when
 * attendance_source isn't 'manual_override'; a CSV import IS overwritable by automatic data,
 * enforced there — this route just never downgrades a booking that's already automatic).
 */
export default withAuth(
  async (req, res, session) => {
    const id = asStr(req.query.id).trim();
    const csvText = typeof req.body?.csv === "string" ? req.body.csv : "";
    const fileName = asStr(req.body?.fileName).trim() || "attendance.csv";
    if (!csvText.trim()) {
      res.status(400).json({ message: "csv is required." });
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { booking_links: { select: { user_id: true } } },
    });
    if (!booking || booking.booking_links.user_id !== session.user.id) {
      res.status(404).json({ message: "Booking not found." });
      return;
    }
    if (booking.attendance_source === "automatic") {
      res.status(409).json({ message: "This booking already has an automatic attendance report — CSV import isn't needed." });
      return;
    }

    const participants = parseAttendanceCsv(csvText);
    if (!participants) {
      res.status(422).json({ message: "Couldn't find an email column in this file — is it the provider's native attendance export?" });
      return;
    }

    const { held, attendeeCount, durationSeconds } = computeAttendance({
      inviteeEmail: booking.invitee_email,
      participants,
      meetingStartIso: booking.start_at.toISOString(),
      meetingEndIso: booking.end_at.toISOString(),
    });

    const fromStatus = booking.attendance_status;
    const toStatus = held ? "held" : "not_held";
    await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data: {
          attendance_status: toStatus,
          attendee_emails: participants as unknown as Prisma.InputJsonValue,
          attendee_count: attendeeCount,
          duration_seconds: durationSeconds,
          held_at: held ? new Date() : null,
          attendance_source: "csv_import",
        },
      }),
      prisma.bookingStatusEvent.create({
        data: {
          booking_id: id,
          from_status: fromStatus,
          to_status: toStatus,
          changed_by_user_id: session.user.id,
          note: `csv_import: ${fileName}`,
        },
      }),
    ]);

    res.status(200).json({ ok: true, attendanceStatus: toStatus, attendeeCount, durationSeconds });
  },
  { methods: ["POST"] }
);
