import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ message: "Method not allowed" });

  const session = await requireRole(req, res, ["admin"]);
  if (!session) return;

  const { clientId } = req.query;
  
  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ message: "Client ID is required" });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    await prisma.client.delete({
      where: { id: clientId }
    });

    res.status(200).json({ message: "Client deleted successfully", clientId });
  } catch (err) {
    console.error("/api/admin/deleteClient error", err);
    res.status(500).json({ message: "Failed to delete client" });
  }
}

