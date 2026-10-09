-- Migration: 20261009000000_run_template_name_snapshot.sql
--
-- A completed run rendered its template name by joining `session_runs` ->
-- `sessions` at read time. Deleting the template therefore collapsed every
-- historical run that used it to "Deleted template". This adds a frozen copy of
-- the name onto the run itself, following the convention RunDrill already uses
-- (it snapshots drill name/stroke/distance so history survives template edits).
--
-- The snapshot is written once, at run start, and never refreshed. Renaming a
-- template does not rewrite history.
--
-- Also backfills existing rows from the template that is still present. Runs
-- whose template is already gone stay NULL and keep their legacy fallback.

alter table if exists session_runs add column if not exists session_name text;

update session_runs r
set session_name = s.name
from sessions s
where s.id = r.session_id
  and r.session_name is null
  and s.deleted_at is null;

comment on column session_runs.session_name is
  'Frozen template name captured when the run started. Never refreshed; history must survive the template being renamed or deleted.';
