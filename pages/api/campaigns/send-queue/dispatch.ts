import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { runCampaignSendQueueTick } from "@/lib/campaigns/sendQueueTick";

/**
 * Cron dispatch endpoint for the campaign send queue. NOT session-authenticated —
 * it runs on behalf of every company, so it's protected by the shared CRON_SECRET
 * (same mechanism as gmail/scheduled/dispatch). Invoked by the Netlify Scheduled
 * Function (netlify/functions/dispatch-campaign-queue).
 *
 * Iterates the distinct companies that have at least one ACTIVE campaign and runs
 * runCampaignSendQueueTick for each (which itself respects per-campaign daily limits
 * and next_send_at, so re-running frequently is safe/idempotent).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ message: "Method not allowed." });
    return;
  }

  const secret = process.env.CRON_SECRET || "";
  const provided =
    (typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "") ||
    String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  try {
    const companies = await prisma.campaign.findMany({
      where: { status: "active" },
      distinct: ["company_id"],
      select: { company_id: true },
    });

    const totals = { companies: 0, processed: 0, sent: 0, failed: 0, skipped: 0 };
    for (const { company_id } of companies) {
      try {
        const r = await runCampaignSendQueueTick(company_id);
        totals.companies += 1;
        totals.processed += r.processed;
        totals.sent += r.sent;
        totals.failed += r.failed;
        totals.skipped += r.skipped;
      } catch (e) {
        // One company's failure shouldn't abort the rest of the sweep.
        console.error("campaign send-queue dispatch: company", company_id, "failed:", e);
      }
    }

    res.status(200).json({ ok: true, ...totals });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Dispatch failed." });
  }
}
