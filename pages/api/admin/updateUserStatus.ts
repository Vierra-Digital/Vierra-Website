import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { computePresenceStatus } from "@/lib/presence";

export default withAuth(
  async (req, res, session) => {
    const { companyId } = session;

    const members = await prisma.companyMembership.findMany({
      where: { company_id: companyId },
      select: { id: true, status: true, last_active_at: true },
    });

    const updates = members.flatMap((m) => {
      const newStatus = computePresenceStatus(m.last_active_at);
      return m.status === newStatus ? [] : [{ id: m.id, status: newStatus }];
    });

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) => prisma.companyMembership.update({ where: { id: u.id }, data: { status: u.status } }))
      );
    }

    return res.status(200).json({
      message: "Status updated successfully",
      updatedCount: updates.length,
    });
  },
  { methods: ["POST"], roles: ["admin", "staff"] }
);
