import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/**
 * List the caller's booked meetings (across all of their booking links), newest first.
 * Scoped by ownership of the parent booking link. Degrades gracefully if the table is
 * missing (P2021).
 */
export default withAuth(
  async (_req, res, session) => {
    try {
      const bookings = await prisma.booking.findMany({
        where: { booking_links: { user_id: session.user.id } },
        orderBy: { start_at: "desc" },
        take: 100,
        select: {
          id: true,
          invitee_name: true,
          invitee_email: true,
          invitee_notes: true,
          start_at: true,
          end_at: true,
          status: true,
          booking_links: { select: { title: true, account_email: true, duration_minutes: true } },
        },
      });
      res.status(200).json({
        bookings: bookings.map((b) => ({
          id: b.id,
          inviteeName: b.invitee_name,
          inviteeEmail: b.invitee_email,
          inviteeNotes: b.invitee_notes,
          startAt: b.start_at.toISOString(),
          endAt: b.end_at.toISOString(),
          status: b.status,
          title: b.booking_links?.title || "Meeting",
          accountEmail: b.booking_links?.account_email || "",
          durationMinutes: b.booking_links?.duration_minutes || null,
        })),
      });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2021") {
        res.status(200).json({ bookings: [], degraded: true });
        return;
      }
      throw e;
    }
  },
  { methods: ["GET"] }
);
