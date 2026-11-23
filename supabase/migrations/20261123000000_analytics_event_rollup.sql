-- Read-only analytics rollup for the owner usage view.
-- SECURITY INVOKER keeps analytics_events RLS in force (authenticated users can
-- only see their own rows via analytics_events_select_own).
-- window_days is clamped to 1..30 (supported owner view windows).

create or replace function public.analytics_event_rollup(window_days integer)
returns table (event_name text, day date, event_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    ae.event_name,
    date_trunc('day', to_timestamp(ae.timestamp / 1000.0))::date as day,
    count(*)::bigint as event_count
  from public.analytics_events ae
  where ae.user_id = auth.uid()
    and ae.timestamp > (
      extract(epoch from now() - make_interval(days => least(greatest(window_days, 1), 30))) * 1000
    )::bigint
  group by ae.event_name, day
  order by day desc, event_count desc;
$$;

revoke execute on function public.analytics_event_rollup(integer) from public, anon;
grant execute on function public.analytics_event_rollup(integer) to authenticated, service_role;
