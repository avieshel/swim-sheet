-- Migration: 20260925000002_cleanup_analytics_events.sql
-- Adds cleanup function to purge analytics events older than 21 days

create or replace function cleanup_old_analytics_events()
returns void
language plpgsql
security definer
as $$
begin
  delete from analytics_events
  where created_at < now() - interval '21 days';
end;
$$;

-- Optional: If pg_cron extension is enabled in Supabase, you can schedule this function to run daily at 3 AM UTC:
-- select cron.schedule(
--   'cleanup-analytics-daily',
--   '0 3 * * *',
--   $$select cleanup_old_analytics_events();$$
-- );
