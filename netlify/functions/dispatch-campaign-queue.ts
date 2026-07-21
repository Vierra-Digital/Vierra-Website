/**
 * Netlify Scheduled Function — fires every 5 minutes and asks the app to run the
 * campaign send queue for every company with an active campaign. It only triggers
 * the work (with the shared CRON_SECRET); the actual sending happens in
 * /api/campaigns/send-queue/dispatch so it reuses the app's Prisma client and send
 * core. The tick respects each campaign's daily_send_limit + next_send_at, so a
 * 5-minute cadence is safe and idempotent.
 *
 * Required env (set in Netlify): NEXT_PUBLIC_SITE_URL (or APP_URL), CRON_SECRET.
 */
const handler = async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  if (!base || !secret) {
    return new Response("Campaign-queue dispatch skipped: NEXT_PUBLIC_SITE_URL and CRON_SECRET must be set.", {
      status: 500,
    });
  }
  try {
    const res = await fetch(`${base}/api/campaigns/send-queue/dispatch`, {
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
