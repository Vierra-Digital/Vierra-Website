import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { cancelBooking } from "@/lib/booking/reschedule";

/** Host-initiated cancel (from the settings UI) — owner, claiming host, or a company admin. */
export default withAuth(
  async (req, res, session) => {
    const id = asStr(req.query.id).trim();
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { claimed_by_user_id: true, booking_links: { select: { user_id: true, company_id: true } } },
    });
    if (!booking) {
      res.status(404).json({ message: "Booking not found." });
      return;
    }
    const isOwner = booking.booking_links.user_id === session.user.id || booking.claimed_by_user_id === session.user.id;
    let isAdmin = false;
    if (!isOwner && booking.booking_links.company_id) {
      const membership = await prisma.companyMembership.findUnique({ where: { user_id: session.user.id }, select: { company_id: true, role: true } });
      isAdmin = membership?.company_id === booking.booking_links.company_id && membership.role === "admin";
    }
    if (!isOwner && !isAdmin) {
      res.status(403).json({ message: "Not authorized to cancel this booking." });
      return;
    }

    const result = await cancelBooking(id);
    if (!result.ok) {
      res.status(409).json({ message: result.message });
      return;
    }
    res.status(200).json({ ok: true });
  },
  { methods: ["POST"] }
);
