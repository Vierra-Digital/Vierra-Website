import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

/**
 * Lightweight, token-authed endpoint for the Vierra browser extension to bump
 * the LinkedIn outreach "attempt" count on the marketing tracker.
 *
 * The extension runs on linkedin.com and can't use the site's Supabase session
 * cookie (cross-origin), so it authenticates with a shared secret instead. This
 * intentionally needs NO database migration — it's driven entirely by env vars:
 *
 *   EXTENSION_TRACK_TOKEN       - shared secret; the extension sends it as a Bearer token
 *   EXTENSION_TRACK_USER_ID     - the user_id whose tracker to increment
 *   EXTENSION_TRACK_COMPANY_ID  - that user's company_id (for the create branch)
 *
 * On each POST it increments marketing_tracker.attempt for outreach="linkedin"
 * for the current month (upsert). No body required.
 */
function applyCors(res: NextApiResponse) {
  // Guarded by the secret token, so a permissive origin is acceptable here.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

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

  const expected = (process.env.EXTENSION_TRACK_TOKEN || "").trim();
  const provided = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!expected || provided !== expected) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const userId = (process.env.EXTENSION_TRACK_USER_ID || "").trim();
  const companyId = (process.env.EXTENSION_TRACK_COMPANY_ID || "").trim();
  if (!userId || !companyId) {
    res.status(500).json({ message: "Extension tracking is not configured on the server." });
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  try {
    const row = await prisma.marketingTracker.upsert({
      where: {
        user_id_year_month_outreach: { user_id: userId, year, month, outreach: "linkedin" },
      },
      update: { attempt: { increment: 1 }, updated_at: now },
      create: {
        company_id: companyId,
        user_id: userId,
        year,
        month,
        outreach: "linkedin",
        attempt: 1,
      },
      select: { attempt: true },
    });
    res.status(200).json({ success: true, outreach: "linkedin", year, month, attempt: row.attempt });
  } catch (e) {
    console.error("extension/track error:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
