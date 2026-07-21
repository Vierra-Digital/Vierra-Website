import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { applyCors, requireExtensionAuth } from "@/lib/extension/auth";

/**
 * Sync per-client outreach aggregates from the extension's local log.
 *
 * The extension is the source of truth for sent/replied (reply flags are set
 * manually there and can change), so it recomputes {sent, replied} per client
 * and month and pushes them here. We SET (not increment) those two fields; the
 * manual funnel fields (meetings_set, clients_closed, revenue_cents) are owned
 * by the panel and left untouched.
 *
 * Body: { stats: [{ clientId, year, month, sent, replied, outreach? }] }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const ctx = requireExtensionAuth(req, res);
  if (!ctx) return;

  const stats = Array.isArray(req.body?.stats) ? req.body.stats : null;
  if (!stats) {
    res.status(400).json({ message: "Missing stats array" });
    return;
  }

  try {
    // Only allow writes to clients that belong to this company.
    const owned = await prisma.client.findMany({
      where: { company_id: ctx.companyId },
      select: { id: true },
    });
    const validIds = new Set(owned.map((c) => c.id));

    let written = 0;
    for (const s of stats) {
      const clientId = String(s?.clientId || "");
      const year = Number(s?.year);
      const month = Number(s?.month);
      const sent = Math.max(0, Math.floor(Number(s?.sent) || 0));
      const replied = Math.max(0, Math.floor(Number(s?.replied) || 0));
      const outreach = s?.outreach ? String(s.outreach) : "linkedin";
      if (!validIds.has(clientId) || !year || !month) continue;

      await prisma.clientOutreachTracker.upsert({
        where: {
          client_id_year_month_outreach: { client_id: clientId, year, month, outreach },
        },
        update: { sent, replied, updated_at: new Date() },
        create: {
          company_id: ctx.companyId,
          client_id: clientId,
          user_id: ctx.userId,
          year,
          month,
          outreach,
          sent,
          replied,
        },
      });
      written += 1;
    }
    res.status(200).json({ success: true, written });
  } catch (e) {
    console.error("extension/client-stats error:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
