import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

const VALID_STATUSES = new Set(["held", "not_held"]);

/**
 * Manual held/not-held override for a booking (MEETING_TRACKING_QUESTIONS.md §5/§16 — hosts can
 * always correct the automatic determination, and every override is audit-logged). A manual
 * override is sticky: syncBookingAttendance skips any booking with attendance_source =
 * 'manual_override', so a later automatic sync never silently reverts a host's correction.
 */
export default withAuth(
  async (req, res, session) => {
    const id = asStr(req.query.id).trim();
    const status = asStr(req.body?.status).trim();
    const note = asStr(req.body?.note).trim();
    if (!VALID_STATUSES.has(status)) {
      res.status(400).json({ message: "status must be 'held' or 'not_held'." });
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

    const fromStatus = booking.attendance_status;
    await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data: {
          attendance_status: status,
          attendance_source: "manual_override",
          held_at: status === "held" ? new Date() : null,
        },
      }),
      prisma.bookingStatusEvent.create({
        data: {
          booking_id: id,
          from_status: fromStatus,
          to_status: status,
          changed_by_user_id: session.user.id,
          note: note || null,
        },
      }),
    ]);

    res.status(200).json({ ok: true });
  },
  { methods: ["PATCH"] }
);
