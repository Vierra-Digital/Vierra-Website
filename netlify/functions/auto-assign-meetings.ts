/**
 * Netlify Scheduled Function — round-robin auto-assign fallback for team booking-link slots
 * that sat unclaimed 12 hours after the prospect picked them. Runs every 5 minutes (same
 * cadence as dispatch-campaign-queue.ts) so the deadline check is reasonably prompt without
 * hammering the DB; the actual logic lives in /api/booking/auto-assign/dispatch.ts.
 *
 * Required env (set in Netlify): NEXT_PUBLIC_SITE_URL (or APP_URL), CRON_SECRET.
 */
const handler = async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  if (!base || !secret) {
    return new Response("Auto-assign dispatch skipped: NEXT_PUBLIC_SITE_URL and CRON_SECRET must be set.", { status: 500 });
  }
  try {
    const res = await fetch(`${base}/api/booking/auto-assign/dispatch`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const text = await res.text();
    return new Response(text, { status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "dispatch fetch failed";
    return new Response(message, { status: 502 });
  }
};

export default handler;

/** Every 5 minutes. */
export const config = { schedule: "*/5 * * * *" };
