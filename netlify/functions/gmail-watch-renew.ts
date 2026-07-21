/**
 * Netlify Scheduled Function — re-registers Gmail push watches daily. A Gmail users.watch
 * expires after 7 days, so we renew well ahead of that by hitting /api/gmail/watch (which
 * re-registers every connected account; idempotent). No-op unless GMAIL_PUBSUB_TOPIC is set
 * on the app side.
 *
 * Required env: NEXT_PUBLIC_SITE_URL (or APP_URL), CRON_SECRET.
 */
const handler = async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  if (!base || !secret) {
    return new Response("Gmail watch renew skipped: NEXT_PUBLIC_SITE_URL and CRON_SECRET must be set.", { status: 500 });
  }
  try {
    const res = await fetch(`${base}/api/gmail/watch`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const text = await res.text();
    return new Response(text, { status: res.status });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "watch renew fetch failed", { status: 502 });
  }
};

export default handler;

/** Daily at 06:00 UTC (well within the 7-day watch TTL). */
export const config = { schedule: "0 6 * * *" };
