import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  try {
    const now = new Date();
    const expired = await prisma.onboardingSession.updateMany({
      where: {
        status: { in: ["pending", "in_progress"] },
        expires_at: { not: null, lt: now },
      },
      data: { status: "expired", last_updated_at: now },
    });

    return res.status(200).json({ updated: expired.count });
  } catch (e) {
    console.error("expireSessions error", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}


