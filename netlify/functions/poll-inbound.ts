/**
 * Netlify Scheduled Function — polls connected Gmail accounts for new mail every 5
 * minutes and runs the inbound hooks. Triggers the work only (with CRON_SECRET); the
 * actual polling happens in /api/gmail/inbound/dispatch so it reuses the app's Prisma
 * client and Gmail helpers.
 *
 * Required env (Netlify): NEXT_PUBLIC_SITE_URL (or APP_URL), CRON_SECRET.
 */
const handler = async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  if (!base || !secret) {
    return new Response("Inbound poll skipped: NEXT_PUBLIC_SITE_URL and CRON_SECRET must be set.", { status: 500 });
  }
  try {
    const res = await fetch(`${base}/api/gmail/inbound/dispatch`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const text = await res.text();
    return new Response(text, { status: res.status });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "poll fetch failed", { status: 502 });
  }
};

export default handler;

/** Every 5 minutes. */
export const config = { schedule: "*/5 * * * *" };
