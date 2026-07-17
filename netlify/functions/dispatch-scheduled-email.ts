/**
 * Netlify Scheduled Function — fires every minute and asks the app to dispatch any
 * due scheduled email sends. It only triggers the work (with the shared CRON_SECRET);
 * the actual sending happens in /api/gmail/scheduled/dispatch so it reuses the app's
 * Prisma client and send core.
 *
 * Required env (set in Netlify): NEXT_PUBLIC_SITE_URL (or APP_URL), CRON_SECRET.
 */
const handler = async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  if (!base || !secret) {
    return new Response("Scheduled-send dispatch skipped: NEXT_PUBLIC_SITE_URL and CRON_SECRET must be set.", {
      status: 500,
    });
  }
  try {
    const res = await fetch(`${base}/api/gmail/scheduled/dispatch`, {
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

/** Every minute — the finest granularity Netlify cron allows. */
export const config = { schedule: "* * * * *" };
