import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { computePresenceStatus } from "@/lib/presence";

/**
 * Five most recently active teammates for the dashboard's staff panel.
 *
 * Ordered by last_active_at rather than by the stored status column, so the list reflects who
 * has actually been around. Status itself is recomputed from last_active_at with the same
 * thresholds as Staff Orbital's StatusBadge (see lib/presence.ts) so the two views never disagree.
 */
export default withAuth(
  async (req, res, session) => {
    const rows = await prisma.companyMembership.findMany({
      where: { company_id: session.companyId },
      select: {
        user_id: true,
        role: true,
        position: true,
        last_active_at: true,
        users_company_memberships_user_idTousers: { select: { name: true, email: true } },
      },
      orderBy: [{ last_active_at: { sort: "desc", nulls: "last" } }],
      take: 5,
    });

    res.status(200).json({
      staff: rows.map((row) => {
        const status = computePresenceStatus(row.last_active_at);
        return {
          userId: row.user_id,
          name: row.users_company_memberships_user_idTousers?.name || null,
          email: row.users_company_memberships_user_idTousers?.email || null,
          role: row.role,
          position: row.position,
          status,
          lastActiveAt: row.last_active_at ? row.last_active_at.toISOString() : null,
          isLive: status === "online",
        };
      }),
    });
  },
  { methods: ["GET"] }
);
