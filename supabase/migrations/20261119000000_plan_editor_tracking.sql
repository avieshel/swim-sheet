-- Migration: 20261119000000_plan_editor_tracking.sql
-- Phase 2 (sync): record who last edited a session-plan row so the coach-assist
-- flow can surface "an owner (or teammate) tuned your plan" and apply
-- owner-wins-on-conflict for the session-plan layer.
--
-- Additive + idempotent. updated_by is nullable and is set by a trigger from the
-- acting auth user, mirroring the existing set_updated_at pattern. It is never
-- sent by the client (toCloudRow does not include it); the cloud is the source
-- of truth for who edited.

alter table sessions add column if not exists updated_by uuid references profiles(id) on delete set null;
alter table drills add column if not exists updated_by uuid references profiles(id) on delete set null;
alter table library_drills add column if not exists updated_by uuid references profiles(id) on delete set null;

create or replace function set_plan_editor()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists sessions_set_plan_editor on sessions;
create trigger sessions_set_plan_editor
  before insert or update on sessions
  for each row execute function set_plan_editor();

drop trigger if exists drills_set_plan_editor on drills;
create trigger drills_set_plan_editor
  before insert or update on drills
  for each row execute function set_plan_editor();

drop trigger if exists library_drills_set_plan_editor on library_drills;
create trigger library_drills_set_plan_editor
  before insert or update on library_drills
  for each row execute function set_plan_editor();
