import { withCronAuth } from "../_shared/auth.ts";
import { sendEmailCore, type SendEmailPayload } from "../_shared/sendCore.ts";

/**
 * Cron dispatch for persisted scheduled sends. Edge Function port of
 * pages/api/gmail/scheduled/dispatch.ts + lib/gmail/scheduledSend.ts::dispatchDueScheduledSends,
 * called directly by Supabase pg_cron (extensions.cron_dispatch_edge, once the cutover in
 * prisma/manual/20260905_edge_fn_dispatch_scheduled_email.sql is applied) instead of over HTTP to
 * the Netlify-hosted app — pg_net's calls to vierradev.com get a Cloudflare Bot Fight Mode 403,
 * which is what forced this move (see that migration file and the 20260901/20260902 ones).
 *
 * Same claim/retry semantics as the Node version: a stale SENDING row (crashed worker) is always
 * marked FAILED rather than auto-retried, since resetting it to PENDING risks double-sending a
 * message that actually went out before the crash. Each due row is claimed with a conditional
 * update (status='PENDING' -> 'SENDING') so overlapping ticks can't double-send.
 */

const MAX_ATTEMPTS = 3;
const DISPATCH_BATCH = 25;
const STALE_SENDING_MS = 10 * 60 * 1000;

const BASE_URL = (Deno.env.get("NEXT_PUBLIC_SITE_URL") || Deno.env.get("APP_URL") || "").replace(/\/$/, "");

Deno.serve(
  withCronAuth(async (_req, supabase) => {
    const now = new Date();

    const staleBefore = new Date(now.getTime() - STALE_SENDING_MS).toISOString();
    await supabase
      .from("email_scheduled_sends")
      .update({
        status: "FAILED",
        last_error: "Send timed out in an indeterminate state — verify manually whether it was delivered before resending.",
        updated_at: now.toISOString(),
      })
      .eq("status", "SENDING")
      .lt("updated_at", staleBefore);

    const { data: due, error: dueError } = await supabase
      .from("email_scheduled_sends")
      .select("id, user_id, account_email, payload, attempts")
      .eq("status", "PENDING")
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(DISPATCH_BATCH);

    if (dueError) {
      console.error("dispatch-scheduled-email: failed to load due rows:", dueError);
      return Response.json({ message: "Failed to load due scheduled sends." }, { status: 500 });
    }

    const summary = { processed: 0, sent: 0, failed: 0 };

    for (const row of due || []) {
      const { data: claimed } = await supabase
        .from("email_scheduled_sends")
        .update({ status: "SENDING", attempts: row.attempts + 1, updated_at: now.toISOString() })
        .eq("id", row.id)
        .eq("status", "PENDING")
        .select("id");
      if (!claimed || claimed.length === 0) continue;
      summary.processed += 1;

      const payload = row.payload as unknown as SendEmailPayload;
      let result: Awaited<ReturnType<typeof sendEmailCore>>;
      try {
        result = await sendEmailCore(supabase, row.user_id, { ...payload, accountEmail: row.account_email }, BASE_URL);
      } catch (error) {
        result = { ok: false, status: 500, message: error instanceof Error ? error.message : "Send crashed." };
      }

      if (result.ok) {
        summary.sent += 1;
        await supabase
          .from("email_scheduled_sends")
          .update({
            status: "SENT",
            sent_at: now.toISOString(),
            outbound_message_id: result.outboundId,
            last_error: null,
            updated_at: now.toISOString(),
          })
          .eq("id", row.id);
      } else {
        const permanent = result.status >= 400 && result.status < 500;
        const giveUp = permanent || row.attempts + 1 >= MAX_ATTEMPTS;
        summary.failed += 1;
        await supabase
          .from("email_scheduled_sends")
          .update({
            status: giveUp ? "FAILED" : "PENDING",
            last_error: result.message.slice(0, 500),
            updated_at: now.toISOString(),
          })
          .eq("id", row.id);
      }
    }

    return Response.json(summary);
  })
);
