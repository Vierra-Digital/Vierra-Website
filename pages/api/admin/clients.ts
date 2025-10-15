import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

// Minimal admin clients list API
// Returns clients with latest onboarding session answers mapped to table columns
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });

  try {
    const clients = await prisma.client.findMany({
      include: {
        onboardingSessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const rows = clients.map((c) => {
      const latest = c.onboardingSessions?.[0] ?? null;
      const answers: any = (latest?.answers as any) ?? {};

      // Map to desired columns; fall back to sensible defaults
      const website = answers.website ?? "";
      const targetAudience = answers.targetAudience ?? "";
      const adGoal = answers.socialMediaGoals ?? "N/A";
      const brandTone = answers.brandTone ?? "N/A";
      
      // Determine display status based on session state and expiration
      let displayStatus = latest?.status ?? "pending";
      const isExpired = latest?.expiresAt && now > latest.expiresAt;
      
      // If session is pending/in_progress but expired and not completed, mark as inactive
      if (isExpired && displayStatus !== "completed") {
        displayStatus = "expired";
      }
      
      // Override with client's isActive flag if manually set to inactive
      if (!c.isActive) {
        displayStatus = "inactive";
      }

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        businessName: c.businessName,
        website,
        targetAudience,
        adGoal,
        brandTone,
        status: displayStatus,
        isActive: c.isActive,
        isExpired: isExpired || false,
      };
    });

    res.json(rows);
  } catch (err) {
    console.error("/api/admin/clients error", err);
    res.status(500).json({ message: "Failed to load clients" });
  }
}


