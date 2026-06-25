import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await requireRole(req, res);
  if (!session) return;
  const { companyId } = session;

  try {
    const sessions = await prisma.onboardingSession.findMany({
      where: { company_id: companyId },
      include: {
        clients: true,
        onboarding_platform_tokens: { select: { platform: true } },
      },
      orderBy: { created_at: "desc" },
    });

    const sessionList = sessions.map((s) => ({
      token: s.id,
      clientName: s.clients.name,
      clientEmail: s.clients.email,
      businessName: s.clients.business_name,
      createdAt: s.created_at.getTime(),
      submittedAt: s.submitted_at?.getTime() || null,
      lastUpdatedAt: s.last_updated_at?.getTime() || null,
      status: s.status || "pending",
      hasAnswers: !!s.answers,
      platforms: s.onboarding_platform_tokens.map((t) => t.platform),
    }));

    res.status(200).json(sessionList);
  } catch (err) {
    console.error("Error listing sessions:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}
