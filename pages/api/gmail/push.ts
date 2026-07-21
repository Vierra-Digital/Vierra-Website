import type { NextApiRequest, NextApiResponse } from "next";
import { processInboundForAllAccounts } from "@/lib/gmail/inbound";

/**
 * Google Pub/Sub push endpoint for Gmail notifications. When Gmail watch (see /api/gmail/watch)
 * fires, Pub/Sub POSTs here with { message: { data: base64(JSON{ emailAddress, historyId }) } }.
 * We trigger the same inbound processing the poll cron uses — it's cursor-based (historyId per
 * account), so re-running is cheap + idempotent and we don't need to trust the payload.
 *
 * Auth: a shared secret in the push subscription URL (?token=…), since Pub/Sub can't send our
 * headers. Configure the subscription endpoint as:
 *   https://vierradev.com/api/gmail/push?token=<GMAIL_PUSH_TOKEN or CRON_SECRET>
 * We ack fast (2xx) so Pub/Sub doesn't redeliver; processing is quick due to the cursor.
 */
function resolveBaseUrl(req: NextApiRequest) {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "";
  if (explicit) return explicit.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000");
  return `${proto}://${host}`.replace(/\/$/, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method not allowed." });
    return;
  }

  const secret = process.env.GMAIL_PUSH_TOKEN || process.env.CRON_SECRET || "";
  const provided = typeof req.query.token === "string" ? req.query.token : "";
  if (!secret || provided !== secret) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  // Best-effort decode for logging; processing doesn't depend on it.
  try {
    const data = (req.body as { message?: { data?: string } })?.message?.data;
    if (data) {
      const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as {
        emailAddress?: string;
        historyId?: string | number;
      };
      console.log("gmail push:", decoded.emailAddress, decoded.historyId);
    }
  } catch {
    /* ignore malformed payloads */
  }

  try {
    await processInboundForAllAccounts(resolveBaseUrl(req), new Date());
  } catch (e) {
    console.error("gmail push processing error:", e);
  }

  // Always ack so Pub/Sub doesn't retry (processing is idempotent via the historyId cursor).
  res.status(204).end();
}
