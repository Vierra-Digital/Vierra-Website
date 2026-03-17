import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import {
  getSessionRole,
  handleApiError,
  requireMethodOrRespond405,
  requireRolesOrRespond403,
  requireSessionOrRespond401,
} from "@/lib/api/guards";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireMethodOrRespond405(req, res, ["GET"]);
    const session = await requireSessionOrRespond401(req, res);
    const role = getSessionRole(session);
    requireRolesOrRespond403(res, role, ["admin"]);

    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        businessName: true,
        monthlyRetainerCents: true,
        clientGoal: true,
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
        clientGoal: typeof c.clientGoal === "number" ? c.clientGoal : null,
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
    handleApiError(res, "/api/admin/clients error", err, "Failed to load clients");
  }
}


