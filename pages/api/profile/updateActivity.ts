import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const su = session.user as { id: string; name?: string | null; email?: string | null };

    const { status } = req.body;
    if (status && !["online", "offline", "away", "busy"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    if (status) {
      // Stamp the time too: `status` on its own can't tell the dashboard how long someone has
      // been online, or whether an "online" is stale because their tab closed without reporting.
      await prisma.companyMembership.updateMany({
        where: { user_id: su.id },
        data: { status, last_active_at: new Date() },
      });
    }

    return res.status(200).json({ id: su.id, name: su.name ?? null, email: su.email ?? null, status: status ?? null });
  },
  { methods: ["POST"] }
);
