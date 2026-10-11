-- ── Tombstone retention ─────────────────────────────────────────────────
--
-- Soft-deleted rows are kept as tombstones (deleted_at is not null) so other
-- devices learn about the delete through the normal cursor-based pull. Left
-- alone they accumulate forever, so this adds a partial index per table and a
-- scheduled purge that physically removes tombstones older than the retention
-- window.
--
-- Two invariants make the purge safe:
--
--   1. Child-first order. Every FK between domain tables is `on delete cascade`,
--      so deleting a parent takes its children with it regardless of whether
--      those children are live. Children are therefore always purged first.
--
--   2. A tombstoned parent is purged only once its whole dependent subtree is
--      also purged (`not exists (live child)`). Without this, purging a deleted
--      session template 30 days later would cascade into that template's
--      historical runs and destroy completed history that was never deleted.
--      The net effect: a purge removes only fully-dead subtrees, never a
--      partially-dead one.

-- ── 1. Partial indexes ──────────────────────────────────────────────────
--
-- Without these the purge is a sequential scan on every table. The `where
-- deleted_at is not null` predicate keeps the index to tombstoned rows only.

create index if not exists idx_swimmers_deleted_at on public.swimmers(deleted_at) where deleted_at is not null;
create index if not exists idx_sessions_deleted_at on public.sessions(deleted_at) where deleted_at is not null;
create index if not exists idx_drills_deleted_at on public.drills(deleted_at) where deleted_at is not null;
create index if not exists idx_library_drills_deleted_at on public.library_drills(deleted_at) where deleted_at is not null;
create index if not exists idx_session_runs_deleted_at on public.session_runs(deleted_at) where deleted_at is not null;
create index if not exists idx_run_drills_deleted_at on public.run_drills(deleted_at) where deleted_at is not null;
create index if not exists idx_run_swimmers_deleted_at on public.run_swimmers(deleted_at) where deleted_at is not null;
create index if not exists idx_laps_deleted_at on public.laps(deleted_at) where deleted_at is not null;
create index if not exists idx_lane_drill_results_deleted_at on public.lane_drill_results(deleted_at) where deleted_at is not null;

-- ── 2. Purge function ───────────────────────────────────────────────────

create or replace function public.purge_expired_tombstones(p_retention_days integer default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
  v_count bigint;
begin
  if p_retention_days is null or p_retention_days < 1 then
    raise exception 'p_retention_days must be >= 1, got %', p_retention_days;
  end if;

  v_cutoff := now() - make_interval(days => p_retention_days);

  -- ── Leaf tables: no table references them, so no guard is needed. ──────

  delete from public.laps where deleted_at < v_cutoff;
  get diagnostics v_count = row_count;
  raise notice 'purge laps: %', v_count;

  delete from public.lane_drill_results where deleted_at < v_cutoff;
  get diagnostics v_count = row_count;
  raise notice 'purge lane_drill_results: %', v_count;

  delete from public.run_swimmers where deleted_at < v_cutoff;
  get diagnostics v_count = row_count;
  raise notice 'purge run_swimmers: %', v_count;

  delete from public.drills where deleted_at < v_cutoff;
  get diagnostics v_count = row_count;
  raise notice 'purge drills: %', v_count;

  delete from public.library_drills where deleted_at < v_cutoff;
  get diagnostics v_count = row_count;
  raise notice 'purge library_drills: %', v_count;

  -- ── Parents: purge only when every dependent row is itself purged. ─────
  --
  -- A `not exists` guard that finds no live child means the whole subtree is
  -- already tombstone-only. A single `delete ... where id in (select ...)` on
  -- each child would not help: cascade fires on the parent row regardless of
  -- the child's own deleted_at.

  delete from public.run_drills rd
  where rd.deleted_at < v_cutoff
    and not exists (select 1 from public.laps l where l.run_drill_id = rd.id and l.deleted_at is null)
    and not exists (select 1 from public.lane_drill_results r where r.run_drill_id = rd.id and r.deleted_at is null);
  get diagnostics v_count = row_count;
  raise notice 'purge run_drills: %', v_count;

  delete from public.session_runs sr
  where sr.deleted_at < v_cutoff
    and not exists (select 1 from public.run_drills rd where rd.run_id = sr.id and rd.deleted_at is null)
    and not exists (select 1 from public.run_swimmers rs where rs.run_id = sr.id and rs.deleted_at is null)
    and not exists (select 1 from public.lane_drill_results r where r.run_id = sr.id and r.deleted_at is null);
  get diagnostics v_count = row_count;
  raise notice 'purge session_runs: %', v_count;

  delete from public.swimmers s
  where s.deleted_at < v_cutoff
    and not exists (select 1 from public.run_swimmers rs where rs.swimmer_id = s.id and rs.deleted_at is null)
    and not exists (select 1 from public.laps l where l.swimmer_id = s.id and l.deleted_at is null);
  get diagnostics v_count = row_count;
  raise notice 'purge swimmers: %', v_count;

  delete from public.sessions s
  where s.deleted_at < v_cutoff
    and not exists (select 1 from public.drills d where d.session_id = s.id and d.deleted_at is null)
    and not exists (select 1 from public.session_runs sr where sr.session_id = s.id and sr.deleted_at is null);
  get diagnostics v_count = row_count;
  raise notice 'purge sessions: %', v_count;

  raise notice 'purge complete: purged tombstones older than % days (cutoff %)', p_retention_days, v_cutoff;
end;
$$;

-- SECURITY DEFINER runs as the table owner (BYPASSRLS), so this must stay
-- unreachable from anon/authenticated -- see the note on cleanup_old_analytics_events
-- in 20261005001000_initial_schema.sql.
revoke execute on function public.purge_expired_tombstones(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_tombstones(integer) to service_role;

-- ── 3. Not yet implemented: unused user-created library drills ─────────
--
-- A future retention pass should purge library drills that were created by a
-- user and are no longer referenced by any session. This is NOT part of
-- purge_expired_tombstones() and is deliberately left unimplemented: it needs
-- the drills.library_drill_id provenance column from
-- docs/superpowers/specs/2026-10-11-frozen-history-snapshot-design.md, which
-- does not exist yet. Implement it in that work, not here.
--
-- When it is written, the guard conditions are:
--
--   1. source in ('personal', 'customized'). NEVER purge source = 'builtin'.
--      Builtins are the immutable catalog seeded from client/src/data/drills.json
--      (57 drills plus the default sessions); deleting one would silently break
--      patchLibraryDrills() propagation to every install.
--   2. No row in drills references it. library_drill_id is a SOFT reference, so
--      there is no FK to block the delete and no cascade to protect us -- the
--      check must be explicit:
--        not exists (select 1 from drills d where d.library_drill_id = lb.id)
--   3. Tombstoned past the same retention window as everything else. A live
--      library drill is not garbage just because nothing references it yet.
--
-- Note that library_drills.organization_id is NULLABLE, unlike every other
-- domain table, so catalog rows may have no organization at all. Scope any
-- retention query by organization explicitly rather than relying on the usual
-- "organization_id is not null" tenant predicate.

-- ── 4. Daily schedule ───────────────────────────────────────────────────

-- pg_cron is a toggle in the Supabase dashboard rather than something every
-- project can create on demand, so a failure here must not abort the migration.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable: enable it in the Supabase dashboard, then call purge_expired_tombstones() from an external scheduler';
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-tombstones';
    perform cron.schedule('purge-expired-tombstones', '17 4 * * *', 'select public.purge_expired_tombstones(30)');
    raise notice 'scheduled purge-expired-tombstones daily at 04:17 UTC';
  else
    raise notice 'pg_cron not installed: schedule purge_expired_tombstones(30) externally';
  end if;
end;
$$;