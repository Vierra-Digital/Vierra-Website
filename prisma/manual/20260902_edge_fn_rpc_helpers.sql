-- Phase 1 of the Netlify -> Supabase Edge Functions dispatch migration (see supabase/functions/
-- for the Deno side of this). This adds:
--   1. public.purge_expired_meeting_pii() -- the SQL port of lib/booking/retention.ts's
--      purgeExpiredMeetingPii(), called by supabase/functions/booking-retention/index.ts via
--      supabase-js .rpc() instead of Prisma (Prisma's Node pg-driver adapter doesn't run in Deno).
--   2. extensions.cron_dispatch_edge(fn_name) -- a second pg_net dispatch helper alongside the
--      existing extensions.cron_dispatch(path) (see 20260901_migrate_cron_to_pg_cron.sql), which
--      calls a Supabase Edge Function URL instead of the Netlify-hosted app. This is what lets
--      pg_cron invoke dispatch logic without leaving Supabase's network -- no Cloudflare hop, no
--      Bot Fight Mode 403.
--
-- MANUAL STEP REQUIRED BEFORE running this file (Supabase SQL editor, run once, NOT checked into
-- git -- embeds a live URL):
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_functions_base_url');
--
-- (Find <project-ref> in the project's Settings -> General page, or the dashboard URL -- confirmed
-- against the Function's own "Invoke function" panel in the dashboard, e.g.
-- https://<project-ref>.supabase.co/functions/v1/booking-retention.) Reuses
-- the `cron_secret` already in Vault from the 20260901 migration -- no new secret for that.

create or replace function public.purge_expired_meeting_pii() returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_erased int;
begin
  with candidates as (
    select b.id,
           coalesce(cc.enrolled_at, b.created_at) as anchor
    from bookings b
    left join campaign_contacts cc on cc.id = b.campaign_contact_id
    where b.pii_erased_at is null
    limit 500
  ),
  to_erase as (
    select id from candidates where anchor <= now() - interval '1 year'
  )
  update bookings b
  set invitee_name = '',
      invitee_email = '',
      invitee_notes = null,
      attendee_emails = '[]'::jsonb,
      pii_erased_at = now()
  from to_erase
  where b.id = to_erase.id;

  get diagnostics v_erased = row_count;
  return jsonb_build_object('erased', v_erased);
end;
$$;

revoke all on function public.purge_expired_meeting_pii() from public;
grant execute on function public.purge_expired_meeting_pii() to service_role;

create or replace function extensions.cron_dispatch_edge(fn_name text) returns void
language plpgsql
security definer
set search_path = extensions, vault, pg_catalog
as $$
declare
  v_secret text;
  v_url text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_functions_base_url';
  if v_secret is null or v_url is null then
    raise warning 'cron_dispatch_edge: cron_secret/edge_functions_base_url not set in Vault -- skipping %', fn_name;
    return;
  end if;
  perform net.http_post(
    url := v_url || '/' || fn_name,
    headers := jsonb_build_object('x-cron-secret', v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function extensions.cron_dispatch_edge(text) from public;

-- Cutover (run only after supabase/functions/booking-retention is deployed and manually verified
-- with curl -- see the plan's Phase 1 testing gates):
--
--   select cron.unschedule('purge-meeting-pii');
--   select cron.schedule('purge-meeting-pii', '0 3 * * *', $$select extensions.cron_dispatch_edge('booking-retention')$$);
--
-- Verify: select id, status_code, created from net._http_response order by created desc limit 5;
-- Tail results:  select * from cron.job_run_details order by start_time desc limit 20;
-- Roll back to the Netlify path: select cron.unschedule('purge-meeting-pii'); select
--   cron.schedule('purge-meeting-pii', '0 3 * * *', $$select extensions.cron_dispatch('/api/booking/retention/dispatch')$$);
