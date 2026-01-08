import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ message: "Method not allowed" });

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  
  const role = (session.user as any)?.role;
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });

  const { token } = req.query;
  
  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Session token is required" });
  }

  try {
    // Check if session exists
    const onboardingSession = await prisma.onboardingSession.findUnique({
      where: { id: token }
    });

    if (!onboardingSession) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Delete the session
    await prisma.onboardingSession.delete({
      where: { id: token }
    });

    res.status(200).json({ message: "Session deleted successfully", token });
  } catch (err) {
    console.error("/api/admin/deleteSession error", err);
    res.status(500).json({ message: "Failed to delete session" });
  }
}

