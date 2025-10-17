import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });

  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { id, name } = req.body ?? {};
  
  if (!id) {
    return res.status(400).json({ message: "Client ID is required" });
  }

  if (typeof name !== "string") {
    return res.status(400).json({ message: "Name must be a string" });
  }

  try {
    const updated = await prisma.client.update({
      where: { id: String(id) },
      data: { name: name.trim() || undefined },
      select: { id: true, name: true, email: true, businessName: true },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("admin/updateClientName", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
