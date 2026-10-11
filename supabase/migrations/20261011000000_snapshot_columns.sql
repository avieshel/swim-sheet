-- Frozen history snapshot. See docs/superpowers/specs/2026-10-11-frozen-history-snapshot-design.md
alter table if exists public.session_runs add column if not exists session_snapshot text;
alter table if exists public.run_drills  add column if not exists drill_index integer;
alter table if exists public.drills      add column if not exists library_drill_id uuid;

-- Soft reference: no foreign key. See spec, "Changed: Drill — library provenance".
create index if not exists idx_drills_library_drill_id on public.drills(library_drill_id);