import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const memberships = await prisma.companyMembership.findMany({
      where: { company_id: session.companyId },
      select: {
        role: true,
        position: true,
        users_company_memberships_user_idTousers: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const members = memberships.map((m) => ({
      id: m.users_company_memberships_user_idTousers.id,
      name: m.users_company_memberships_user_idTousers.name,
      email: m.users_company_memberships_user_idTousers.email,
      role: m.role,
      position: m.position,
    }));

    return res.status(200).json(members);
  } catch (e) {
    console.error("project/boardMembers GET", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
