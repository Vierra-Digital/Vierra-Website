import type { NextApiRequest, NextApiResponse } from "next";
import { asStr } from "@/lib/api/parsing";
import { safeCompare } from "@/lib/crypto";
import { syncBookingAttendance } from "@/lib/booking/syncAttendance";

/**
 * Sync one booking's attendance report. CRON_SECRET-protected (same mechanism as
 * campaigns/send-queue/dispatch) — this isn't session-authenticated because the batch
 * dispatcher and the scheduled function both call it without a logged-in user. Also handy
 * for manually verifying a single booking during development (see the implementation plan's
 * verification section).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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

  const id = asStr(req.query.id).trim();
  if (!id) {
    res.status(400).json({ message: "Missing booking id." });
    return;
  }

  const result = await syncBookingAttendance(id);
  res.status(200).json({ result });
}
