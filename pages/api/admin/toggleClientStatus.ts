import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") return res.status(405).json({ message: "Method not allowed" });

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  
  const role = (session.user as any)?.role;
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });

  const { clientId, isActive } = req.body;
  
  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ message: "Client ID is required" });
  }

  if (typeof isActive !== "boolean") {
    return res.status(400).json({ message: "isActive must be a boolean" });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    await prisma.client.update({
      where: { id: clientId },
      data: { isActive }
    });

    res.status(200).json({ 
      message: `Client ${isActive ? 'activated' : 'deactivated'} successfully`, 
      clientId,
      isActive
    });
  } catch (err) {
    console.error("/api/admin/toggleClientStatus error", err);
    res.status(500).json({ message: "Failed to update client status" });
  }
}

