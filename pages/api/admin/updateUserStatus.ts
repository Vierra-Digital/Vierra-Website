import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const { companyId } = session;

    // In v2, last_active_at is not tracked on the model; set all members offline as default.
    const result = await prisma.companyMembership.updateMany({
      where: { company_id: companyId, status: { not: "offline" } },
      data: { status: "offline" },
    });

    return res.status(200).json({
      message: "Status updated successfully",
      updatedCount: result.count,
    });
  },
  { methods: ["POST"], roles: ["admin", "staff"] }
);
