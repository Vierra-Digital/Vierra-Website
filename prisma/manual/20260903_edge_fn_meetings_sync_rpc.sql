-- Phase 2 of the Netlify -> Supabase Edge Functions dispatch migration: RPC backing
-- supabase/functions/dashboard-meetings-sync/index.ts (the SQL port of
-- lib/dashboard/upcomingMeetings.ts::syncUpcomingMeetingsForUser's atomic
-- delete+insert+upsert, called via supabase-js .rpc() since Prisma's $transaction doesn't run
-- in Deno).

create or replace function public.sync_upcoming_meetings_write(
  p_user_id uuid,
  p_meetings jsonb,
  p_status jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from dashboard_upcoming_meetings where user_id = p_user_id;

  insert into dashboard_upcoming_meetings (user_id, event_id, title, organizer, start_at, end_at, time_zone, meeting_link)
  select p_user_id,
         (m->>'event_id'),
         (m->>'title'),
         (m->>'organizer'),
         (m->>'start_at')::timestamptz,
         (m->>'end_at')::timestamptz,
         (m->>'time_zone'),
         coalesce(m->>'meeting_link', '')
  from jsonb_array_elements(p_meetings) as m;

  insert into dashboard_meetings_sync_status (user_id, connected, connected_email, needs_reconnect, issue_code, issue_message, synced_at)
  values (
    p_user_id,
    coalesce((p_status->>'connected')::boolean, false),
    p_status->>'connected_email',
    coalesce((p_status->>'needs_reconnect')::boolean, false),
    coalesce(p_status->>'issue_code', 'none'),
    p_status->>'issue_message',
    now()
  )
  on conflict (user_id) do update set
    connected = excluded.connected,
    connected_email = excluded.connected_email,
    needs_reconnect = excluded.needs_reconnect,
    issue_code = excluded.issue_code,
    issue_message = excluded.issue_message,
    synced_at = now();
end;
$$;

revoke all on function public.sync_upcoming_meetings_write(uuid, jsonb, jsonb) from public;
grant execute on function public.sync_upcoming_meetings_write(uuid, jsonb, jsonb) to service_role;

-- Cutover (run only after supabase/functions/dashboard-meetings-sync is deployed and manually
-- verified against a real connected-Gmail user -- see the plan's Phase 2 testing gates):
--
--   select cron.unschedule('sync-upcoming-meetings');
--   select cron.schedule('sync-upcoming-meetings', '*/5 * * * *', $$select extensions.cron_dispatch_edge('dashboard-meetings-sync')$$);
--
-- Verify: select id, status_code, created from net._http_response order by created desc limit 5;
-- Roll back to the Netlify path: select cron.unschedule('sync-upcoming-meetings'); select
--   cron.schedule('sync-upcoming-meetings', '*/5 * * * *', $$select extensions.cron_dispatch('/api/dashboard/meetings-sync/dispatch')$$);
