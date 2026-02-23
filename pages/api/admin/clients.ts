import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });

  try {
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        businessName: true,
        monthlyRetainerCents: true,
        image: true,
        createdAt: true,
        isActive: true,
        onboardingSessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            answers: true,
            expiresAt: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const rows = clients.map((c) => {
      const latest = c.onboardingSessions?.[0] ?? null;
      const answers: any = (latest?.answers as any) ?? {};
      const website = answers.website ?? "";
      const targetAudience = answers.targetAudience ?? "";
      const adGoal = answers.socialMediaGoals ?? "N/A";
      const clientGoal = "N/A";
      const brandTone = answers.brandTone ?? "N/A";
      const industry = answers.industry ?? "";
      let displayStatus: string = latest?.status ?? "pending";
      const isExpired = latest?.expiresAt && now > latest.expiresAt;
      if (isExpired && displayStatus !== "completed") {
        displayStatus = "expired";
      }
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
        clientGoal,
        brandTone,
        industry,
        monthlyRetainer: typeof c.monthlyRetainerCents === "number" ? c.monthlyRetainerCents / 100 : null,
        status: displayStatus,
        isActive: c.isActive,
        isExpired: isExpired || false,
        image: Boolean(c.image),
      };
    });

    res.json(rows);
  } catch (err) {
    console.error("/api/admin/clients error", err);
    res.status(500).json({ message: "Failed to load clients" });
  }
}


