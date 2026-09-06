import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

/**
 * Everything the client overview shows, in one request.
 *
 * The three tabs are one screen, so they load together rather than firing a request each time
 * someone switches tab — the payload is small and the alternative is three spinners for data that
 * was already worth fetching.
 *
 * A representative always reads their own company and anything they send is ignored. A Vierra
 * staff member names the client they are looking at; role model v2 lets any of them look at any
 * client, so the parameter selects rather than authorises.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  // requireSession rather than withAuth: this is one of the few routes a representative reads
  // too, and withAuth resolves member sessions only.
  const session = await requireSession(req, res);
  if (!session) return;

  {
    // Someone signed in but not yet attached to a company has nothing to show.
    if (session.kind === "unaffiliated") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const companyId =
      session.kind === "client" ? session.companyId : resolveTargetCompanyId(session, req);
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    try {
      const campaignScope = { campaigns: { company_id: companyId } };
      const [campaigns, leadCount, billing, revenue] = await Promise.all([
        prisma.campaign.findMany({
          where: { company_id: companyId },
          orderBy: [{ started_at: "desc" }, { created_at: "desc" }],
          take: 100,
          select: {
            id: true,
            name: true,
            status: true,
            created_at: true,
            started_at: true,
            completed_at: true,
            _count: { select: { campaign_contacts: true, campaign_steps: true } },
          },
        }),
        prisma.campaignContact.count({ where: campaignScope }),
        prisma.financeEntry.findMany({
          // Expenses are Vierra's own costs, not something a client was charged; only revenue is
          // "what you were billed".
          where: { company_id: companyId, kind: "revenue" },
          orderBy: { occurred_at: "desc" },
          take: 100,
          select: { id: true, amount_cents: true, occurred_at: true, note: true },
        }),
        prisma.financeEntry.aggregate({
          where: { company_id: companyId, kind: "revenue" },
          _sum: { amount_cents: true },
        }),
      ]);

      return res.status(200).json({
        analytics: {
          campaigns: campaigns.length,
          activeCampaigns: campaigns.filter((c) => c.status === "active" || c.status === "running")
            .length,
          leads: leadCount,
          billedCents: revenue._sum.amount_cents ?? 0,
        },
        campaigns: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          contacts: c._count.campaign_contacts,
          steps: c._count.campaign_steps,
          createdAt: c.created_at.toISOString(),
          startedAt: c.started_at ? c.started_at.toISOString() : null,
          completedAt: c.completed_at ? c.completed_at.toISOString() : null,
        })),
        billing: billing.map((entry) => ({
          id: entry.id,
          amountCents: entry.amount_cents,
          occurredAt: entry.occurred_at.toISOString(),
          note: entry.note,
        })),
      });
    } catch (e) {
      console.error("client/overview GET", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }
}
