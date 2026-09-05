/**
 * Netlify Scheduled Function — refreshes the DB-cached upcoming-meetings list for every user
 * with a connected Gmail account, by hitting /api/dashboard/meetings-sync/dispatch. This is
 * what moves the live Google Calendar API calls off the per-login critical path: the dashboard
 * GET endpoint just reads whatever this last wrote.
 *
 * Required env: NEXT_PUBLIC_SITE_URL (or APP_URL), CRON_SECRET.
 */
const handler = async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  if (!base || !secret) {
    return new Response("Meetings sync skipped: NEXT_PUBLIC_SITE_URL and CRON_SECRET must be set.", { status: 500 });
  }
  try {
    const res = await fetch(`${base}/api/dashboard/meetings-sync/dispatch`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const text = await res.text();
    return new Response(text, { status: res.status });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "meetings sync fetch failed", { status: 502 });
  }
};

export default handler;

/** Every 5 minutes. */
export const config = { schedule: "*/5 * * * *" };
