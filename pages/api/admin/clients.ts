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
    const companyId = (session as any).companyId as string;

    const clients = await prisma.client.findMany({
      where: { company_id: companyId },
      select: {
        id: true,
        name: true,
        email: true,
        business_name: true,
        client_goal: true,
        image_storage_key: true,
        created_at: true,
        is_active: true,
        client_billing: { select: { monthly_retainer_cents: true } },
        onboarding_sessions: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            answers: true,
            expires_at: true,
            status: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const now = new Date();
    const rows = clients.map((c) => {
      const latest = c.onboarding_sessions?.[0] ?? null;
      const answers: any = (latest?.answers as any) ?? {};
      const website = answers.website ?? "";
      const targetAudience = answers.targetAudience ?? "";
      const adGoal = answers.socialMediaGoals ?? "N/A";
      const brandTone = answers.brandTone ?? "N/A";
      const industry = answers.industry ?? "";
      let displayStatus: string = latest?.status ?? "pending";
      const isExpired = latest?.expires_at && now > latest.expires_at;
      if (isExpired && displayStatus !== "completed") {
        displayStatus = "expired";
      }
      if (!c.is_active) {
        displayStatus = "inactive";
      }

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        businessName: c.business_name,
        website,
        targetAudience,
        adGoal,
        clientGoal: typeof c.client_goal === "number" ? c.client_goal : null,
        brandTone,
        industry,
        monthlyRetainer:
          typeof c.client_billing?.monthly_retainer_cents === "number"
            ? c.client_billing.monthly_retainer_cents / 100
            : null,
        status: displayStatus,
        isActive: c.is_active,
        isExpired: isExpired || false,
        image: Boolean(c.image_storage_key),
      };
    });

    res.json(rows);
  } catch (err) {
    handleApiError(res, "/api/admin/clients error", err, "Failed to load clients");
  }
}
