-- Migration: 20261004000001_domain_rls_policies.sql
-- Account/Sync plan P0 — tenant-scoped RLS only.
-- Every domain policy: school_id = row tenant; membership + permission checked
-- against THAT row's school_id. Deletes are owner-only (permission gate).
-- Drops all policies from the superseded draft migrations first.

-- ── Drop superseded draft policies ────────────────────────────────────

drop policy if exists "Users can upsert own profile" on profiles;
drop policy if exists "Authenticated users can read swim_schools" on swim_schools;
drop policy if exists "Public can read swim_schools" on swim_schools;
drop policy if exists "Authenticated users can read school_roles" on school_roles;
drop policy if exists "Authenticated users can read permissions" on permissions;
drop policy if exists "Authenticated users can read role_permissions" on role_permissions;
drop policy if exists "Users can read own school_memberships" on school_memberships;
drop policy if exists "Admins can manage school_memberships" on school_memberships;
drop policy if exists "Users can CRUD own swimmers" on swimmers;
drop policy if exists "Anyone can read swimmers" on swimmers;
drop policy if exists "Users can CRUD own sessions" on sessions;
drop policy if exists "Users can CRUD own drills" on drills;
drop policy if exists "Users can CRUD own session_runs" on session_runs;
drop policy if exists "Users can CRUD own laps" on laps;
drop policy if exists "Admin full access (school:manage)" on swimmers;
drop policy if exists "Admin full access sessions" on sessions;
drop policy if exists "Admin full access drills" on drills;
drop policy if exists "Coach can CRUD own sessions" on sessions;
drop policy if exists "Coach can CRUD own drills" on drills;
drop policy if exists "Coach can CRUD own swimmers" on swimmers;
drop policy if exists "Users can manage swimmers in their schools" on swimmers;
drop policy if exists "Only admin can delete swimmers" on swimmers;
drop policy if exists "Only admin can delete sessions" on sessions;
drop policy if exists "Only admin can delete drills" on drills;
drop policy if exists "Authenticated users can read own analytics" on analytics_events;

-- ── Enable RLS ────────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table swim_schools enable row level security;
alter table school_roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table school_memberships enable row level security;
alter table swimmers enable row level security;
alter table sessions enable row level security;
alter table drills enable row level security;
alter table library_drills enable row level security;
alter table session_runs enable row level security;
alter table run_drills enable row level security;
alter table run_swimmers enable row level security;
alter table laps enable row level security;
alter table feature_toggles enable row level security;
alter table school_invites enable row level security;
alter table analytics_events enable row level security;

-- ── profiles: self only ───────────────────────────────────────────────

create policy profiles_select on profiles
  for select to authenticated
  using (auth.uid() = id);

create policy profiles_insert on profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update on profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── catalogs: readable when authenticated (no PII) ────────────────────

create policy permissions_select on permissions
  for select to authenticated
  using (true);

create policy swim_schools_select on swim_schools
  for select to authenticated
  using (is_school_member(id));

create policy school_roles_select on school_roles
  for select to authenticated
  using (is_school_member(school_id));

create policy role_permissions_select on role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from school_roles sr
      where sr.id = role_permissions.role_id
        and is_school_member(sr.school_id)
    )
  );

-- ── school_memberships ────────────────────────────────────────────────

create policy school_memberships_select on school_memberships
  for select to authenticated
  using (user_id = auth.uid() or is_school_member(school_id));

create policy school_memberships_manage on school_memberships
  for all to authenticated
  using (
    is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'school:members_manage')
  )
  with check (
    is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'school:members_manage')
  );

-- ── swimmers ──────────────────────────────────────────────────────────

create policy swimmers_select on swimmers
  for select to authenticated
  using (school_id is not null and is_school_member(school_id));

create policy swimmers_insert on swimmers
  for insert to authenticated
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'swimmer:create')
  );

create policy swimmers_update on swimmers
  for update to authenticated
  using (school_id is not null and is_school_member(school_id))
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'swimmer:edit')
  );

create policy swimmers_delete on swimmers
  for delete to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'swimmer:remove')
  );

-- ── sessions ──────────────────────────────────────────────────────────

create policy sessions_select on sessions
  for select to authenticated
  using (school_id is not null and is_school_member(school_id));

create policy sessions_insert on sessions
  for insert to authenticated
  with check (
    school_id is not null
    and is_school_member(school_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), school_id, 'session:create')
  );

create policy sessions_update on sessions
  for update to authenticated
  using (school_id is not null and is_school_member(school_id))
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'session:edit')
  );

create policy sessions_delete on sessions
  for delete to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'session:delete')
  );

-- ── drills ────────────────────────────────────────────────────────────

create policy drills_select on drills
  for select to authenticated
  using (school_id is not null and is_school_member(school_id));

create policy drills_insert on drills
  for insert to authenticated
  with check (
    school_id is not null
    and is_school_member(school_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), school_id, 'drill:create')
  );

create policy drills_update on drills
  for update to authenticated
  using (school_id is not null and is_school_member(school_id))
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'drill:edit')
  );

create policy drills_delete on drills
  for delete to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'drill:delete')
  );

-- ── library_drills (null school_id = shared builtin, read-only) ───────

create policy library_drills_select on library_drills
  for select to authenticated
  using (school_id is null or is_school_member(school_id));

create policy library_drills_insert on library_drills
  for insert to authenticated
  with check (
    school_id is not null
    and is_school_member(school_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), school_id, 'library:manage')
  );

create policy library_drills_update on library_drills
  for update to authenticated
  using (school_id is not null and is_school_member(school_id))
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'library:manage')
  );

create policy library_drills_delete on library_drills
  for delete to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'library:delete')
  );

-- ── session_runs / run_drills / run_swimmers / laps ───────────────────
-- Coach + collaborator with sync:use can write school run data.
-- Deletes remain owner-only (school:manage covers owner's full permission set).

create policy session_runs_select on session_runs
  for select to authenticated
  using (school_id is not null and is_school_member(school_id));

create policy session_runs_insert on session_runs
  for insert to authenticated
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'sync:use')
  );

create policy session_runs_update on session_runs
  for update to authenticated
  using (school_id is not null and is_school_member(school_id))
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'sync:use')
  );

create policy session_runs_delete on session_runs
  for delete to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'school:manage')
  );

create policy run_drills_select on run_drills
  for select to authenticated
  using (school_id is not null and is_school_member(school_id));

create policy run_drills_insert on run_drills
  for insert to authenticated
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'sync:use')
  );

create policy run_drills_update on run_drills
  for update to authenticated
  using (school_id is not null and is_school_member(school_id))
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'sync:use')
  );

create policy run_drills_delete on run_drills
  for delete to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'school:manage')
  );

create policy run_swimmers_select on run_swimmers
  for select to authenticated
  using (school_id is not null and is_school_member(school_id));

create policy run_swimmers_insert on run_swimmers
  for insert to authenticated
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'sync:use')
  );

create policy run_swimmers_update on run_swimmers
  for update to authenticated
  using (school_id is not null and is_school_member(school_id))
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'sync:use')
  );

create policy run_swimmers_delete on run_swimmers
  for delete to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'school:manage')
  );

create policy laps_select on laps
  for select to authenticated
  using (school_id is not null and is_school_member(school_id));

create policy laps_insert on laps
  for insert to authenticated
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'sync:use')
  );

create policy laps_update on laps
  for update to authenticated
  using (school_id is not null and is_school_member(school_id))
  with check (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'sync:use')
  );

create policy laps_delete on laps
  for delete to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'school:manage')
  );

-- ── feature_toggles: members read; owner (school:manage) writes ───────

create policy feature_toggles_select on feature_toggles
  for select to authenticated
  using (is_school_member(school_id));

create policy feature_toggles_update on feature_toggles
  for update to authenticated
  using (
    is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'school:manage')
  )
  with check (
    is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'school:manage')
  );

-- ── school_invites ────────────────────────────────────────────────────

create policy school_invites_select on school_invites
  for select to authenticated
  using (
    is_school_member(school_id)
    and user_has_permission(auth.uid(), school_id, 'school:invite')
  );

create policy school_invites_insert on school_invites
  for insert to authenticated
  with check (
    is_school_member(school_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), school_id, 'school:invite')
  );

-- ── analytics_events: own rows only for authenticated select ──────────

create policy analytics_events_select_own on analytics_events
  for select to authenticated
  using (user_id = auth.uid());
