import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/** Open (unclaimed) team-link slots for the caller's company — the claim queue UI reads this. */
export default withAuth(
  async (req, res, session) => {
    const membership = await prisma.companyMembership.findUnique({
      where: { user_id: session.user.id },
      select: { company_id: true },
    });
    if (!membership) {
      res.status(200).json({ slots: [] });
      return;
    }

    const bookings = await prisma.booking.findMany({
      where: { status: "slot_claimed", booking_links: { company_id: membership.company_id } },
      orderBy: { start_at: "asc" },
      select: {
        id: true,
        invitee_name: true,
        start_at: true,
        end_at: true,
        claim_deadline_at: true,
        booking_links: { select: { title: true, provider: true } },
      },
    });

    res.status(200).json({
      slots: bookings.map((b) => ({
        id: b.id,
        inviteeName: b.invitee_name,
        startAt: b.start_at.toISOString(),
        endAt: b.end_at.toISOString(),
        claimDeadlineAt: b.claim_deadline_at?.toISOString() || null,
        title: b.booking_links.title,
        provider: b.booking_links.provider,
      })),
    });
  },
  { methods: ["GET"] }
);
