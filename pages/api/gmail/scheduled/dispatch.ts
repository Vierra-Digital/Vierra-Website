import type { NextApiRequest, NextApiResponse } from "next";
import { dispatchDueScheduledSends } from "@/lib/gmail/scheduledSend";

/**
 * Cron dispatch endpoint for scheduled email sends. NOT session-authenticated —
 * it runs on behalf of many users, so it's protected by a shared CRON_SECRET.
 * Invoked by the Netlify Scheduled Function (netlify/functions/dispatch-scheduled-email).
 */

/** Public origin used to build tracking pixel/click URLs from the worker context. */
function resolveBaseUrl(req: NextApiRequest) {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "";
  if (explicit) return explicit.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000");
  return `${proto}://${host}`.replace(/\/$/, "");
}

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
    const summary = await dispatchDueScheduledSends(resolveBaseUrl(req), new Date());
    res.status(200).json({ ok: true, ...summary });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Dispatch failed." });
  }
}
