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
    requireRolesOrRespond403(res, role, ["admin", "staff"]);

    // Every Vierra staff member browses every client here now (see
    // docs/ROLE_MODEL_REDESIGN.md's "v2" section) — this doubles as the client switcher's data
    // source, not scoped to one company.
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        company_id: true,
        name: true,
        email: true,
        business_name: true,
        client_goal: true,
        image_storage_key: true,
        created_at: true,
        is_active: true,
        user_id: true,
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
      // A representative who joined an already-onboarded company via team invite (see
      // lib/auth/resolveUser.ts's invite-acceptance branch) never gets an onboarding_sessions row
      // at all — that flow only exists for the primary client onboarding wizard (NDA, Stripe,
      // etc). Defaulting a missing session to "pending" left every such teammate stuck showing
      // as perpetually pending even after they'd finished their own account setup and reached
      // their dashboard. Their user_id is set the moment the invite is accepted (unlike a
      // primary-onboarding client, whose user_id stays null until the wizard actually
      // completes), so its presence is what distinguishes "nothing to complete" from "hasn't
      // started yet."
      let displayStatus: string = latest?.status ?? (c.user_id ? "completed" : "pending");
      const isExpired = latest?.expires_at && now > latest.expires_at;
      if (isExpired && displayStatus !== "completed") {
        displayStatus = "expired";
      }
      if (!c.is_active) {
        displayStatus = "inactive";
      }

      return {
        id: c.id,
        companyId: c.company_id,
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
