/**
 * Netlify Scheduled Function — hourly reconciliation poll for meeting attendance. Triggers
 * /api/booking/sync-attendance/dispatch with the shared CRON_SECRET; the actual work happens
 * there so it reuses the app's Prisma client. See netlify/functions/dispatch-campaign-queue.ts
 * for the identical pattern this mirrors.
 *
 * Required env (set in Netlify): NEXT_PUBLIC_SITE_URL (or APP_URL), CRON_SECRET.
 */
const handler = async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  if (!base || !secret) {
    return new Response("Attendance-sync dispatch skipped: NEXT_PUBLIC_SITE_URL and CRON_SECRET must be set.", {
      status: 500,
    });
  }
  try {
    const res = await fetch(`${base}/api/booking/sync-attendance/dispatch`, {
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

/** Every hour. */
export const config = { schedule: "0 * * * *" };
