import type { NextApiRequest, NextApiResponse } from "next";
import { safeCompare } from "@/lib/crypto";
import { purgeExpiredMeetingPii } from "@/lib/booking/retention";

/** Cron dispatch for the meeting-PII retention sweep — see lib/booking/retention.ts. */
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

  const result = await purgeExpiredMeetingPii();
  res.status(200).json(result);
}
