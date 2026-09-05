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
    // Never cache presence: the panel polls for it, and a cached response defeats the poll.
    res.setHeader("Cache-Control", "no-store")
    res.status(200).json({
      staff: rows.map((row) => {
        const lastActive = row.last_active_at ? row.last_active_at.toISOString() : null;
        const ageMs = row.last_active_at ? now - row.last_active_at.getTime() : null;
        const stale = ageMs === null || ageMs > STALE_AFTER_MS;
        // The stored `status` word is not reliable on its own: sign-out and session-expiry paths
        // write "offline" without clearing last_active_at, so someone who is heartbeating right
        // now can still be sitting on a stale "offline" and get reported as away. The timestamp
        // is the signal that cannot lie — a beat inside the window means present. Only "away" and
        // "busy" are honoured from the stored value, because nothing infers those from timing.
        const declaredAway = row.status === "away" || row.status === "busy";
        return {
          userId: row.user_id,
          name: row.users_company_memberships_user_idTousers?.name || null,
          email: row.users_company_memberships_user_idTousers?.email || null,
          role: row.role,
          position: row.position,
          status: stale ? "offline" : declaredAway ? row.status : "online",
          lastActiveAt: lastActive,
          isLive: !stale && !declaredAway,
        };
      }),
    });
  },
  { methods: ["GET"] }
);
