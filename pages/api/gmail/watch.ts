import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";

/**
 * Register (or renew) Gmail push notifications via users.watch for every connected Gmail
 * account, so new INBOX mail pings our /api/gmail/push webhook instead of waiting for the
 * 5-min poll. Cron-authed (shared CRON_SECRET) so the gmail-watch-renew scheduled function
 * can re-register before the 7-day watch expiry. Dormant until GMAIL_PUBSUB_TOPIC is set.
 *
 * GMAIL_PUBSUB_TOPIC must be the full topic name: projects/<project>/topics/<topic>, and the
 * Gmail service account must have Pub/Sub Publisher on it (set up in Google Cloud).
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

  const topicName = process.env.GMAIL_PUBSUB_TOPIC || "";
  if (!topicName) {
    res.status(200).json({ ok: false, message: "GMAIL_PUBSUB_TOPIC not set — push is inactive (polling still runs)." });
    return;
  }

  const tokens = await prisma.platformToken.findMany({
    where: { platform: { startsWith: "gmail:" } },
    select: { user_id: true, platform: true },
  });

  let registered = 0;
  let failed = 0;
  for (const row of tokens) {
    const accountEmail = row.platform.replace(/^gmail:/, "").toLowerCase();
    if (!accountEmail) continue;
    const token = await getValidGmailAccessToken(row.user_id, accountEmail);
    if (!token.ok) {
      failed += 1;
      continue;
    }
    try {
      const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
        method: "POST",
        headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" }),
      });
      if (r.ok) registered += 1;
      else {
        failed += 1;
        console.error("gmail watch failed for", accountEmail, r.status, await r.text().catch(() => ""));
      }
    } catch (e) {
      failed += 1;
      console.error("gmail watch error for", accountEmail, e);
    }
  }

  res.status(200).json({ ok: true, registered, failed });
}
