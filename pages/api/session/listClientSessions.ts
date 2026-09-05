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
  const isPlatformAdmin = session.user.isPlatformAdmin === true;

  try {
    /**
     * Platform admins see every company's sessions, the same exemption /api/admin/users already
     * makes. Without it the two lists disagreed: User Management listed clients from every
     * company and then looked up their sessions in one company only, so every row outside the
     * caller's own company showed no session at all.
     */
    const sessions = await prisma.onboardingSession.findMany({
      where: isPlatformAdmin ? {} : { company_id: companyId },
      include: {
        clients: true,
        onboarding_platform_tokens: { select: { platform: true } },
      },
      orderBy: { created_at: "desc" },
    });

    /**
     * Expiry is derived from expires_at, not read from the status column.
     *
     * That column only changes when the "Update Sessions" sweep runs, so a session that lapsed an
     * hour ago still reported itself as pending or in progress until someone pressed the button.
     * Completed and canceled are terminal and keep their word whatever the date says.
     */
    const now = Date.now();
    const effectiveStatus = (stored: string, expiresAt: Date | null) => {
      const status = stored || "pending";
      if (status === "completed" || status === "canceled" || status === "expired") return status;
      if (expiresAt && expiresAt.getTime() < now) return "expired";
      return status;
    };

    const sessionList = sessions.map((s) => ({
      token: s.id,
      clientName: s.clients.name,
      clientEmail: s.clients.email,
      businessName: s.clients.business_name,
      createdAt: s.created_at.getTime(),
      submittedAt: s.submitted_at?.getTime() || null,
      lastUpdatedAt: s.last_updated_at?.getTime() || null,
      status: effectiveStatus(s.status, s.expires_at),
      hasAnswers: !!s.answers,
      platforms: s.onboarding_platform_tokens.map((t) => t.platform),
    }));

    res.status(200).json(sessionList);
  } catch (err) {
    console.error("Error listing sessions:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}
