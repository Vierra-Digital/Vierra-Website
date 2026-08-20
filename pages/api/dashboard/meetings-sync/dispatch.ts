import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { safeCompare } from "@/lib/crypto";
import { syncUpcomingMeetingsForUser } from "@/lib/dashboard/upcomingMeetings";

/**
 * Cron dispatch endpoint for the upcoming-meetings background sync (every 5 min, see
 * netlify/functions/sync-upcoming-meetings.ts). CRON_SECRET-protected, same shape as
 * booking/sync-attendance/dispatch. Moves the expensive per-login Google Calendar API calls
 * (pages/api/dashboard/upcoming-meetings.ts used to make these synchronously on every
 * dashboard load) onto a schedule instead — the GET endpoint now just reads the cache this
 * writes.
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
  if (!secret || !safeCompare(provided, secret)) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  // Any user with at least one Gmail token connected is a sync candidate — matches the same
  // scoping the old per-request handler used (platform starts with "gmail:").
  const rows = await prisma.platformToken.findMany({
    where: { platform: { startsWith: "gmail:" } },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const totals = { candidates: rows.length, synced: 0, failed: 0 };
  for (const { user_id } of rows) {
    try {
      await syncUpcomingMeetingsForUser(user_id);
      totals.synced += 1;
    } catch (error) {
      totals.failed += 1;
      console.error("meetings-sync dispatch: user sync failed", user_id, error);
    }
  }

  res.status(200).json(totals);
}
