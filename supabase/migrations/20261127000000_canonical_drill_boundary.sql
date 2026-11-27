-- Canonical vs coach-owned drill boundary.
-- Adds provenance/identity metadata to library_drills and session drills so
-- canonical drills can be cached read-only, coach-owned drills stay org-scoped,
-- and session drills preserve sourceSlug provenance.

-- library_drills: canonical/coach metadata
alter table if exists public.library_drills add column if not exists slug text;
alter table if exists public.library_drills add column if not exists he_name text;
alter table if exists public.library_drills add column if not exists scope text;
alter table if exists public.library_drills add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table if exists public.library_drills add column if not exists derived_from_slug text;
alter table if exists public.library_drills add column if not exists visibility text;
alter table if exists public.library_drills add column if not exists default_equipment jsonb;

-- Canonical slugs are globally unique and admin-reserved. Coach-owned rows may
-- not claim a canonical slug.
create unique index if not exists library_drills_canonical_slug_uniq
  on public.library_drills (slug)
  where scope = 'canonical' and slug is not null;

create index if not exists library_drills_slug_idx
  on public.library_drills (slug)
  where slug is not null;

-- Session template drills carry soft provenance back to the source drill.
alter table if exists public.drills add column if not exists source_slug text;

-- Backfill scope/visibility/owner_id for existing rows. Existing builtins
-- (organization_id is null, source builtin) become canonical/global. Existing
-- org-scoped rows become coach/org.
update public.library_drills
set
  scope = case
    when organization_id is null then 'canonical'
    else coalesce(scope, 'coach')
  end,
  visibility = case
    when organization_id is null then 'global'
    else coalesce(visibility, 'org')
  end,
  owner_id = case
    when organization_id is null then null
    else coalesce(owner_id, created_by)
  end
where scope is null or visibility is null or (organization_id is not null and owner_id is null);

-- sync_pulse: include global canonical library drills for any authenticated
-- member (they are readable by RLS). This keeps server-authoritative canonical
-- catalog updates discoverable without per-org duplication.
create or replace function public.sync_pulse(
  p_organization uuid,
  p_cursors jsonb
)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with requested(table_name, cursor) as (
    select t.table_name, p_cursors ->> t.table_name
    from unnest(array[
      'swimmers', 'sessions', 'drills', 'libraryDrills', 'sessionRuns',
      'runDrills', 'runSwimmers', 'laps', 'laneDrillResults'
    ]) as t(table_name)
  ),
  latest as (
    select r.table_name,
      case r.table_name
        when 'swimmers'        then (select max(updated_at) from public.swimmers        where organization_id = p_organization)
        when 'sessions'        then (select max(updated_at) from public.sessions        where organization_id = p_organization)
        when 'drills'          then (select max(updated_at) from public.drills          where organization_id = p_organization)
        when 'libraryDrills'   then (select max(updated_at) from public.library_drills   where organization_id = p_organization or organization_id is null)
        when 'sessionRuns'     then (select max(updated_at) from public.session_runs    where organization_id = p_organization)
        when 'runDrills'       then (select max(updated_at) from public.run_drills      where organization_id = p_organization)
        when 'runSwimmers'     then (select max(updated_at) from public.run_swimmers    where organization_id = p_organization)
        when 'laps'            then (select max(updated_at) from public.laps            where organization_id = p_organization)
        when 'laneDrillResults' then (select max(updated_at) from public.lane_drill_results where organization_id = p_organization)
      end as max_updated_at
    from requested r
  )
  select coalesce(array_agg(l.table_name), '{}')
  from latest l
  join requested r using (table_name)
  where l.max_updated_at is not null
    and (r.cursor is null or l.max_updated_at > r.cursor::timestamptz);
$$;

comment on function public.sync_pulse(uuid, jsonb) is
  'Returns the subset of requested sync tables whose max(updated_at) is newer than the client cursor. LibraryDrills also considers global canonical rows (organization_id is null). Read-only probe; over-reports rather than under-reports.';

revoke all on function public.sync_pulse(uuid, jsonb) from public;
grant execute on function public.sync_pulse(uuid, jsonb) to authenticated;
