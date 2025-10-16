import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });

  try {
    const users = await prisma.user.findMany({
      where: { role: "user" },
      select: { id: true, email: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json(users);
  } catch (e) {
    console.error("admin/staff GET", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}


