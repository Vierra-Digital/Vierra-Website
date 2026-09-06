import { withCronAuth } from "../_shared/auth.ts";

/**
 * Cron dispatch for the meeting-PII retention sweep. Edge Function port of
 * pages/api/booking/retention/dispatch.ts + lib/booking/retention.ts::purgeExpiredMeetingPii(),
 * called directly by Supabase pg_cron (extensions.cron_dispatch_edge in
 * prisma/manual/20260902_edge_fn_rpc_helpers.sql) instead of over HTTP to the Netlify-hosted app.
 * Auth matches the Netlify routes' `x-cron-secret` check, not Supabase's own JWT gate (see
 * supabase/config.toml's verify_jwt = false for this function).
 */
Deno.serve(
  withCronAuth(async (_req, supabase) => {
    const { data, error } = await supabase.rpc("purge_expired_meeting_pii");
    if (error) {
      console.error("purge_expired_meeting_pii failed:", error);
      return Response.json({ message: "Retention sweep failed." }, { status: 500 });
    }

    return Response.json(data);
  })
);
