-- Moves the 9 Netlify Scheduled Functions in netlify/functions/ onto Supabase pg_cron +
-- pg_net. Netlify was hitting its scheduled-function invocation limit: dispatch-scheduled-email
-- alone fires every minute, plus 4 more every 5 minutes. None of the functions do real work
-- themselves -- each is a thin fetch() that POSTs a CRON_SECRET-guarded /api/.../dispatch route,
-- which does the actual Prisma/Gmail/Calendar work. Only the trigger moves; the dispatch routes,
-- their auth (x-cron-secret, see lib/crypto.ts safeCompare) and all business logic are unchanged.
--
-- MANUAL STEPS REQUIRED BEFORE running this file (Supabase SQL editor, run once, NOT checked
-- into git -- these embed the live secret and base URL):
--
--   select vault.create_secret('<value of CRON_SECRET>', 'cron_secret');
--   select vault.create_secret('https://vierradev.com', 'cron_base_url');
--
-- (Use whatever NEXT_PUBLIC_SITE_URL/APP_URL production actually resolves to.) If either secret
-- is later rotated: `select vault.update_secret(id, '<new value>') from vault.secrets where name = '<name>';`
--
-- After this file is applied, delete netlify/functions/{sync-upcoming-meetings,
-- sync-meeting-attendance,send-meeting-reminders,purge-meeting-pii,poll-inbound,
-- dispatch-campaign-queue,dispatch-scheduled-email,gmail-watch-renew,auto-assign-meetings}.ts
-- and their `config.schedule` registrations disappear from the next Netlify deploy.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Vault ships enabled on Supabase projects by default; this is just documentation of the
-- dependency, not an attempt to install it.
-- create extension if not exists supabase_vault;

-- Wraps net.http_post with the shared secret + base URL pulled from Vault at call time, so no
-- secret is ever embedded in a file committed to the repo. security definer + a pinned
-- search_path because this runs as whichever role owns the cron job.
create or replace function extensions.cron_dispatch(path text) returns void
language plpgsql
security definer
set search_path = extensions, vault, pg_catalog
as $$
declare
  v_secret text;
  v_base text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  select decrypted_secret into v_base from vault.decrypted_secrets where name = 'cron_base_url';
  if v_secret is null or v_base is null then
    raise warning 'cron_dispatch: cron_secret/cron_base_url not set in Vault -- skipping %', path;
    return;
  end if;
  perform net.http_post(
    url := v_base || path,
    headers := jsonb_build_object('x-cron-secret', v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function extensions.cron_dispatch(text) from public;

select cron.schedule(
  'sync-upcoming-meetings', '*/5 * * * *',
  $$select extensions.cron_dispatch('/api/dashboard/meetings-sync/dispatch')$$
);
select cron.schedule(
  'sync-meeting-attendance', '0 * * * *',
  $$select extensions.cron_dispatch('/api/booking/sync-attendance/dispatch')$$
);
select cron.schedule(
  'send-meeting-reminders', '0 * * * *',
  $$select extensions.cron_dispatch('/api/booking/reminders/dispatch')$$
);
select cron.schedule(
  'purge-meeting-pii', '0 3 * * *',
  $$select extensions.cron_dispatch('/api/booking/retention/dispatch')$$
);
select cron.schedule(
  'poll-inbound', '*/5 * * * *',
  $$select extensions.cron_dispatch('/api/gmail/inbound/dispatch')$$
);
select cron.schedule(
  'gmail-watch-renew', '0 6 * * *',
  $$select extensions.cron_dispatch('/api/gmail/watch')$$
);
select cron.schedule(
  'dispatch-campaign-queue', '*/5 * * * *',
  $$select extensions.cron_dispatch('/api/campaigns/send-queue/dispatch')$$
);
select cron.schedule(
  'dispatch-scheduled-email', '* * * * *',
  $$select extensions.cron_dispatch('/api/gmail/scheduled/dispatch')$$
);
select cron.schedule(
  'auto-assign-meetings', '*/5 * * * *',
  $$select extensions.cron_dispatch('/api/booking/auto-assign/dispatch')$$
);

-- Verify: select jobid, jobname, schedule, active from cron.job order by jobname;
-- Tail results:  select * from cron.job_run_details order by start_time desc limit 20;
-- Roll back one job: select cron.unschedule('<jobname>');
