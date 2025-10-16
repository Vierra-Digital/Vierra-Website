import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  try {
    const now = new Date();
    // Find pending or in_progress sessions whose expiresAt is in the past
    const expired = await prisma.onboardingSession.updateMany({
      where: {
        status: { in: ["pending", "in_progress"] },
        expiresAt: { not: null, lt: now },
      },
      data: { status: "expired", lastUpdatedAt: now },
    });

    return res.status(200).json({ updated: expired.count });
  } catch (e) {
    console.error("expireSessions error", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}


