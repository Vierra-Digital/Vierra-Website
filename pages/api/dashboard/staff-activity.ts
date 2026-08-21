import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/**
 * Five most recently active teammates for the dashboard's staff panel.
 *
 * Ordered by last_active_at rather than by status, so the list reflects who has actually been
 * around. An "online" row whose heartbeat stopped hours ago is reported as stale rather than
 * shown as present — the tab can close without ever sending an offline beat.
 */
const STALE_AFTER_MS = 5 * 60 * 1000;

export default withAuth(
  async (req, res, session) => {
    const rows = await prisma.companyMembership.findMany({
      where: { company_id: session.companyId },
      select: {
        user_id: true,
        role: true,
        position: true,
        status: true,
        last_active_at: true,
        users_company_memberships_user_idTousers: { select: { name: true, email: true } },
      },
      orderBy: [{ last_active_at: { sort: "desc", nulls: "last" } }],
      take: 5,
    });

    const now = Date.now();
    res.status(200).json({
      staff: rows.map((row) => {
        const lastActive = row.last_active_at ? row.last_active_at.toISOString() : null;
        const ageMs = row.last_active_at ? now - row.last_active_at.getTime() : null;
        const stale = ageMs === null || ageMs > STALE_AFTER_MS;
        return {
          userId: row.user_id,
          name: row.users_company_memberships_user_idTousers?.name || null,
          email: row.users_company_memberships_user_idTousers?.email || null,
          role: row.role,
          position: row.position,
          // A stale heartbeat is reported as offline regardless of the stored status.
          status: stale && row.status !== "offline" ? "offline" : row.status,
          lastActiveAt: lastActive,
          isLive: !stale && row.status === "online",
        };
      }),
    });
  },
  { methods: ["GET"] }
);
