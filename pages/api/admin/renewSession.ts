import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  
  const role = (session.user as any)?.role;
  if (role !== "admin" && role !== "staff") return res.status(403).json({ message: "Forbidden" });

  const { token } = req.body;
  
  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Session token is required" });
  }

  try {
    const onboardingSession = await prisma.onboardingSession.findUnique({
      where: { id: token },
    });

    if (!onboardingSession) {
      return res.status(404).json({ message: "Session not found" });
    }
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 60 * 60 * 1000);

    const updated = await prisma.onboardingSession.update({
      where: { id: token },
      data: {
        status: "pending",
        expiresAt: newExpiresAt,
        lastUpdatedAt: now,
      },
    });

    res.status(200).json({
      message: "Session renewed successfully",
      token: updated.id,
      status: updated.status,
      link: `/onboarding/${updated.id}`,
    });
  } catch (err) {
    console.error("/api/admin/renewSession error", err);
    res.status(500).json({ message: "Failed to renew session" });
  }
}

