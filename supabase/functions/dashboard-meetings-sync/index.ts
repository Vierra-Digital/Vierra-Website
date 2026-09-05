import { withCronAuth } from "../_shared/auth.ts";
import { syncUpcomingMeetingsForUser } from "../_shared/upcomingMeetings.ts";

/**
 * Cron dispatch for the upcoming-meetings background sync. Edge Function port of
 * pages/api/dashboard/meetings-sync/dispatch.ts + lib/dashboard/upcomingMeetings.ts, called
 * directly by Supabase pg_cron instead of over HTTP to the Netlify-hosted app.
 */
Deno.serve(
  withCronAuth(async (_req, supabase) => {
    const { data: rows, error } = await supabase
      .from("platform_tokens")
      .select("user_id")
      .like("platform", "gmail:%");
    if (error) {
      console.error("meetings-sync dispatch: candidate query failed", error);
      return Response.json({ message: "Failed to load sync candidates." }, { status: 500 });
    }

    const userIds = [...new Set((rows || []).map((r) => r.user_id as string))];
    const totals = { candidates: userIds.length, synced: 0, failed: 0 };
    for (const userId of userIds) {
      try {
        await syncUpcomingMeetingsForUser(supabase, userId);
        totals.synced += 1;
      } catch (err) {
        totals.failed += 1;
        console.error("meetings-sync dispatch: user sync failed", userId, err);
      }
    }

    return Response.json(totals);
  })
);
