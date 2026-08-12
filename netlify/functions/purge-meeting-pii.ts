/**
 * Netlify Scheduled Function — daily meeting-PII retention sweep (1 year from first tracked
 * interaction, see lib/booking/retention.ts). Same trigger-only pattern as
 * netlify/functions/dispatch-campaign-queue.ts.
 *
 * Required env (set in Netlify): NEXT_PUBLIC_SITE_URL (or APP_URL), CRON_SECRET.
 */
const handler = async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  if (!base || !secret) {
    return new Response("Retention dispatch skipped: NEXT_PUBLIC_SITE_URL and CRON_SECRET must be set.", { status: 500 });
  }
  try {
    const res = await fetch(`${base}/api/booking/retention/dispatch`, {
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

/** Once a day at 03:00 UTC. */
export const config = { schedule: "0 3 * * *" };
