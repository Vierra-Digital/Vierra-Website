import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { companyId } = session;

  try {
    // In v2, last_active_at is not tracked on the model; set all members offline as default.
    const result = await prisma.companyMembership.updateMany({
      where: { company_id: companyId, status: { not: "offline" } },
      data: { status: "offline" },
    });

    return res.status(200).json({
      message: "Status updated successfully",
      updatedCount: result.count,
    });
  } catch (e) {
    console.error("admin/updateUserStatus", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
