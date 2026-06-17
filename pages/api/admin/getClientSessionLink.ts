import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { clientEmail } = req.query;
  if (!clientEmail || typeof clientEmail !== "string") {
    return res.status(400).json({ message: "Missing clientEmail" });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { email: clientEmail.toLowerCase() },
      include: {
        onboardingSessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    const latestSession = client.onboardingSessions[0];
    if (latestSession && latestSession.status !== "completed" && !latestSession.submittedAt) {
      const now = new Date();
      const isExpired = latestSession.expiresAt && now > latestSession.expiresAt;
      
      if (!isExpired) {
        return res.status(200).json({
          link: `/onboarding/${latestSession.id}`,
          token: latestSession.id,
          status: latestSession.status,
        });
      }
    }
    const token = crypto.randomUUID();
    await prisma.onboardingSession.create({
      data: {
        id: token,
        clientId: client.id,
        status: "pending",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    return res.status(200).json({
      link: `/onboarding/${token}`,
      token: token,
      status: "pending",
      regenerated: true,
    });
  } catch (err: any) {
    console.error("getClientSessionLink error:", err);
    return res.status(500).json({ message: err?.message || "Internal Server Error" });
  }
}

