import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ message: "Method not allowed" });

  const session = await requireRole(req, res, ["admin"]);
  if (!session) return;

  const { token } = req.query;
  
  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Session token is required" });
  }

  try {
    const onboardingSession = await prisma.onboardingSession.findUnique({
      where: { id: token },
      select: { id: true, clientId: true }
    });

    if (!onboardingSession) {
      return res.status(404).json({ message: "Session not found" });
    }

    const clientId = onboardingSession.clientId;
    await prisma.$transaction(async (tx) => {
      await tx.onboardingSession.delete({
        where: { id: token }
      });
      await tx.client.delete({
        where: { id: clientId }
      });
    });

    res.status(200).json({ message: "Session and client deleted successfully", token });
  } catch (err) {
    console.error("/api/admin/deleteSession error", err);
    res.status(500).json({ message: "Failed to delete session" });
  }
}

