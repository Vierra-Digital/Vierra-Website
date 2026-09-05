-- Phase 2 of the Netlify -> Supabase Edge Functions dispatch migration: RPC backing
-- supabase/functions/booking-sync-attendance/index.ts (the SQL port of
-- lib/booking/syncAttendance.ts::syncBookingAttendance's atomic booking-update +
-- booking_status_events insert, called via supabase-js .rpc() since Prisma's $transaction
-- doesn't run in Deno). Reads the row's current attendance_status as from_status inside the
-- function so it always reflects the true prior value, matching the Node version's semantics.

create or replace function public.record_attendance_sync(
  p_booking_id uuid,
  p_to_status text,
  p_attendee_emails jsonb,
  p_attendee_count int,
  p_duration_seconds int,
  p_held boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_from_status text;
begin
  select attendance_status into v_from_status from bookings where id = p_booking_id for update;
  if v_from_status is null then
    return; -- booking no longer exists
  end if;

  update bookings set
    attendance_status = p_to_status,
    attendee_emails = p_attendee_emails,
    attendee_count = p_attendee_count,
    duration_seconds = p_duration_seconds,
    held_at = case when p_held then now() else null end,
    attendance_source = 'automatic'
  where id = p_booking_id;

  insert into booking_status_events (booking_id, from_status, to_status, changed_by_user_id, note)
  values (p_booking_id, v_from_status, p_to_status, null, 'automatic sync');
end;
$$;

revoke all on function public.record_attendance_sync(uuid, text, jsonb, int, int, boolean) from public;
grant execute on function public.record_attendance_sync(uuid, text, jsonb, int, int, boolean) to service_role;

-- Cutover (run only after supabase/functions/booking-sync-attendance is deployed and manually
-- verified -- see the plan's Phase 2 testing gates):
--
--   select cron.unschedule('sync-meeting-attendance');
--   select cron.schedule('sync-meeting-attendance', '0 * * * *', $$select extensions.cron_dispatch_edge('booking-sync-attendance')$$);
--
-- Verify: select id, status_code, created from net._http_response order by created desc limit 5;
-- Roll back to the Netlify path: select cron.unschedule('sync-meeting-attendance'); select
--   cron.schedule('sync-meeting-attendance', '0 * * * *', $$select extensions.cron_dispatch('/api/booking/sync-attendance/dispatch')$$);
