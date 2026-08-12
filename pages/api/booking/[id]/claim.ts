import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { claimBookingSlot } from "@/lib/booking/claimSlot";

/** A company member claims an open team-link slot from the org queue. */
export default withAuth(
  async (req, res, session) => {
    const id = asStr(req.query.id).trim();
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { status: true, booking_links: { select: { company_id: true } } },
    });
    if (!booking || !booking.booking_links.company_id) {
      res.status(404).json({ message: "Booking not found." });
      return;
    }
    const membership = await prisma.companyMembership.findUnique({
      where: { user_id: session.user.id },
      select: { company_id: true },
    });
    if (!membership || membership.company_id !== booking.booking_links.company_id) {
      res.status(403).json({ message: "Not a member of this team." });
      return;
    }
    if (booking.status !== "slot_claimed") {
      res.status(409).json({ message: "This slot was already taken." });
      return;
    }

    const result = await claimBookingSlot(id, session.user.id);
    if (!result.ok) {
      const message =
        result.reason === "not_claimable"
          ? "This slot was already taken."
          : result.reason === "no_calendar_connected"
            ? "Connect a Google Calendar account before claiming meetings."
            : "Couldn't set up the meeting — try again.";
      res.status(409).json({ message });
      return;
    }
    res.status(200).json({ ok: true });
  },
  { methods: ["POST"] }
);
