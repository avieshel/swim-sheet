-- Migration: 20261014000001_sync_pulse.sql
-- One round trip that answers "could any sync table have rows past my cursors?"
-- so the client can skip its per-table pull fan-out.
--
-- Without this, every sync issued one PostgREST select per sync table (9 of
-- them) on the 60s poll and again after every local edit, and on an idle
-- device almost all of them came back empty. syncNow already costs zero
-- requests when there is nothing to push (push() loops over an empty array),
-- so the pull fan-out was the entire idle cost — ~540 requests/hour/device.
--
-- Deliberately conservative, in both directions:
--
--   * It ignores the per-table visibility and completed-run filters the real
--     pull applies, so a table it reports is one the client will still have to
--     ask for. It can only over-report.
--   * A cursor missing from p_cursors is treated as -infinity, so the table is
--     reported as dirty. A client that stopped sending cursors degrades to
--     today's full fan-out rather than to silently never syncing again.
--
-- Together those mean the function can never report "clean" while a change is
-- waiting, which is the one failure mode that would strand a cursor behind a
-- newer row and lose data with no error. The comparison therefore happens here
-- in Postgres rather than by string-comparing timestamp renderings on the
-- client, where a rendering difference between the two paths would be silent.

create or replace function public.sync_pulse(p_organization uuid, p_cursors jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_organization_member(p_organization) then '[]'::jsonb
    else coalesce((
      select jsonb_agg(t.table_name)
      from (values
        ('swimmers'), ('sessions'), ('drills'), ('libraryDrills'), ('sessionRuns'),
        ('runDrills'), ('runSwimmers'), ('laps'), ('laneDrillResults')
      ) as t(table_name)
      where case t.table_name
        when 'swimmers'         then (select max(updated_at) from public.swimmers          where organization_id = p_organization)
        when 'sessions'         then (select max(updated_at) from public.sessions          where organization_id = p_organization)
        when 'drills'           then (select max(updated_at) from public.drills            where organization_id = p_organization)
        when 'libraryDrills'    then (select max(updated_at) from public.library_drills   where organization_id = p_organization)
        when 'sessionRuns'      then (select max(updated_at) from public.session_runs     where organization_id = p_organization)
        when 'runDrills'        then (select max(updated_at) from public.run_drills       where organization_id = p_organization)
        when 'runSwimmers'      then (select max(updated_at) from public.run_swimmers     where organization_id = p_organization)
        when 'laps'             then (select max(updated_at) from public.laps             where organization_id = p_organization)
        when 'laneDrillResults' then (select max(updated_at) from public.lane_drill_results where organization_id = p_organization)
        else null
      end > coalesce(nullif(p_cursors ->> t.table_name, '')::timestamptz, '-infinity'::timestamptz)
    ), '[]'::jsonb)
  end;
$$;

revoke execute on function public.sync_pulse(uuid, jsonb) from public, anon;
grant execute on function public.sync_pulse(uuid, jsonb) to authenticated;