import type { NextApiRequest, NextApiResponse } from "next";
import { processInboundForAllAccounts } from "@/lib/gmail/inbound";
import { resurfaceDueSnoozes } from "@/lib/gmail/snooze";
import { processSignals } from "@/lib/signals/processSignals";
import { safeCompare } from "@/lib/crypto";
import { resolveCronBaseUrl } from "@/lib/api/url";

/**
 * Cron endpoint that polls all connected Gmail accounts for new mail and runs the
 * inbound hooks (filters, vacation reply, auto-draft, MDN). Session-less; guarded by
 * CRON_SECRET. Invoked by netlify/functions/poll-inbound.
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

  try {
    const now = new Date();
    const summary = await processInboundForAllAccounts(resolveCronBaseUrl(req), now);
    const snooze = await resurfaceDueSnoozes(now);
    const signals = await processSignals(now).catch(() => ({ signals: 0, enrolled: 0 }));
    res.status(200).json({ ok: true, ...summary, resurfaced: snooze.resurfaced, signals: signals.signals, enrolled: signals.enrolled });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Inbound poll failed." });
  }
}
