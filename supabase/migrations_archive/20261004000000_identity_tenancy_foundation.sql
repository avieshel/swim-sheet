-- Migration: 20261004000000_identity_tenancy_foundation.sql
-- Account/Sync plan P0 — identity, tenancy schema, RBAC seed, school RPCs
-- Supersedes draft 20261004000000_add_rls_policies.sql / ...000001_update_rls_policies.sql
-- Rules: tenant_id (school_id) on every domain row; JWT -> memberships -> RLS;
--        deletes owner-only; no in-app god mode; fail-closed.

-- ── 1. Tenant ownership on swim_schools ──────────────────────────────

alter table swim_schools
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_at timestamptz not null default now();

comment on column swim_schools.created_by is 'Owner human who created the school (owner membership also required).';

-- ── 2. Shared helpers ─────────────────────────────────────────────────

create or replace function is_school_member(p_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from school_memberships
    where user_id = auth.uid()
      and school_id = p_school
  );
$$;

create or replace function user_has_permission(p_user_id uuid, p_school_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from school_memberships sm
    join role_permissions rp on rp.role_id = sm.role_id
    where sm.user_id = p_user_id
      and sm.school_id = p_school_id
      and rp.permission_id = p_permission
  );
$$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 3. Permission catalog (frozen matrix) ─────────────────────────────

insert into permissions (id, description) values
  ('school:manage', 'Manage school settings, members, and features'),
  ('school:invite', 'Invite coaches into the school'),
  ('school:members_manage', 'Change member roles or remove members'),
  ('session:create', 'Create session templates'),
  ('session:edit', 'Edit session templates'),
  ('session:delete', 'Delete session templates (owner only)'),
  ('drill:create', 'Create drills'),
  ('drill:edit', 'Edit drills'),
  ('drill:delete', 'Delete drills (owner only)'),
  ('library:manage', 'Create or edit library drills'),
  ('library:delete', 'Delete library drills (owner only)'),
  ('swimmer:create', 'Add swimmers to the roster'),
  ('swimmer:edit', 'Edit swimmers'),
  ('swimmer:remove', 'Remove swimmers (owner only)'),
  ('swimmer:view_school', 'View the school roster'),
  ('sync:use', 'Use cloud sync for school data'),
  ('insights:view', 'View insights and analytics'),
  ('ai_coach:use', 'Use the AI coach agent'),
  ('swimmer:self_view', 'Athlete self-view (reserved, future role)')
on conflict (id) do update set description = excluded.description;

delete from role_permissions where permission_id in ('session:edit_all', 'session:edit_own');
delete from permissions where id in ('session:edit_all', 'session:edit_own');

-- ── 4. Domain tables (client Dexie is source of truth) ────────────────

create table if not exists drills (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references swim_schools(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  name text not null,
  stroke text not null default '',
  distance integer not null default 0,
  drill_order integer not null default 0,
  items jsonb,
  repeat_count integer,
  timing_mode text,
  focus text,
  labels jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_drills_school_id on drills(school_id);
create index if not exists idx_drills_session_id on drills(session_id);
create index if not exists idx_drills_updated_at on drills(updated_at);

create table if not exists library_drills (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references swim_schools(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  name text not null,
  stroke text not null default '',
  distance integer not null default 0,
  items jsonb,
  repeat_count integer,
  timing_mode text,
  focus text,
  labels jsonb,
  description text,
  source text default 'personal',
  popularity integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_library_drills_school_id on library_drills(school_id);
create index if not exists idx_library_drills_updated_at on library_drills(updated_at);

create table if not exists session_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references swim_schools(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  date text,
  pool_name text,
  pool_length integer,
  notes text,
  status text not null default 'active',
  session_started_at double precision,
  session_paused_at double precision,
  session_pause_duration double precision default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_session_runs_school_id on session_runs(school_id);
create index if not exists idx_session_runs_session_id on session_runs(session_id);
create index if not exists idx_session_runs_updated_at on session_runs(updated_at);

create table if not exists run_drills (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references swim_schools(id) on delete cascade,
  run_id uuid not null references session_runs(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  name text not null,
  stroke text not null default '',
  distance integer not null default 0,
  drill_order integer not null default 0,
  notes text,
  instructions text,
  interval text,
  equipment jsonb,
  parent_drill_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_run_drills_school_id on run_drills(school_id);
create index if not exists idx_run_drills_run_id on run_drills(run_id);

create table if not exists run_swimmers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references swim_schools(id) on delete cascade,
  run_id uuid not null references session_runs(id) on delete cascade,
  swimmer_id uuid not null references swimmers(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  lane integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_run_swimmers_school_id on run_swimmers(school_id);
create index if not exists idx_run_swimmers_run_id on run_swimmers(run_id);
create index if not exists idx_run_swimmers_swimmer_id on run_swimmers(swimmer_id);

create table if not exists laps (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references swim_schools(id) on delete cascade,
  run_drill_id uuid not null references run_drills(id) on delete cascade,
  swimmer_id uuid not null references swimmers(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  time double precision not null default 0,
  stroke_count integer,
  effort text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_laps_school_id on laps(school_id);
create index if not exists idx_laps_run_drill_id on laps(run_drill_id);
create index if not exists idx_laps_swimmer_id on laps(swimmer_id);

-- ── 5. Existing tables: tenant + soft-delete columns ──────────────────

alter table swimmers
  add column if not exists created_by uuid references profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz;

alter table sessions
  add column if not exists deleted_at timestamptz;

alter table swimmers add column if not exists updated_at timestamptz not null default now();
alter table sessions add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_swimmers_school_id on swimmers(school_id);
create index if not exists idx_swimmers_updated_at on swimmers(updated_at);
create index if not exists idx_sessions_school_id on sessions(school_id);
create index if not exists idx_sessions_created_by on sessions(created_by);
create index if not exists idx_sessions_updated_at on sessions(updated_at);

-- ── 6. Feature toggles (default open; owner can flip later) ───────────

create table if not exists feature_toggles (
  school_id uuid not null references swim_schools(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (school_id, feature_key)
);

-- ── 7. School invites ─────────────────────────────────────────────────

create table if not exists school_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references swim_schools(id) on delete cascade,
  code text not null unique,
  role_name text not null default 'swim_coach',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by uuid references profiles(id) on delete set null,
  used_at timestamptz
);

create index if not exists idx_school_invites_school_id on school_invites(school_id);

-- ── 8. updated_at triggers ────────────────────────────────────────────

drop trigger if exists swimmers_set_updated_at on swimmers;
create trigger swimmers_set_updated_at
  before update on swimmers
  for each row execute function set_updated_at();

drop trigger if exists sessions_set_updated_at on sessions;
create trigger sessions_set_updated_at
  before update on sessions
  for each row execute function set_updated_at();

drop trigger if exists drills_set_updated_at on drills;
create trigger drills_set_updated_at
  before update on drills
  for each row execute function set_updated_at();

drop trigger if exists library_drills_set_updated_at on library_drills;
create trigger library_drills_set_updated_at
  before update on library_drills
  for each row execute function set_updated_at();

drop trigger if exists session_runs_set_updated_at on session_runs;
create trigger session_runs_set_updated_at
  before update on session_runs
  for each row execute function set_updated_at();

drop trigger if exists run_drills_set_updated_at on run_drills;
create trigger run_drills_set_updated_at
  before update on run_drills
  for each row execute function set_updated_at();

drop trigger if exists run_swimmers_set_updated_at on run_swimmers;
create trigger run_swimmers_set_updated_at
  before update on run_swimmers
  for each row execute function set_updated_at();

drop trigger if exists laps_set_updated_at on laps;
create trigger laps_set_updated_at
  before update on laps
  for each row execute function set_updated_at();

drop trigger if exists swim_schools_set_updated_at on swim_schools;
create trigger swim_schools_set_updated_at
  before update on swim_schools
  for each row execute function set_updated_at();

drop trigger if exists feature_toggles_set_updated_at on feature_toggles;
create trigger feature_toggles_set_updated_at
  before update on feature_toggles
  for each row execute function set_updated_at();

-- ── 9. Auth trigger: profile on signup ────────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, new.id::text), '@', 1)
    ),
    coalesce(new.email, new.id::text)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 10. School RPCs ───────────────────────────────────────────────────

create or replace function create_swim_school(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_owner_role_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'school name is required';
  end if;

  insert into swim_schools (name, created_by)
  values (trim(p_name), v_user_id)
  returning id into v_school_id;

  insert into school_roles (school_id, name, description)
  values
    (v_school_id, 'swim_school_owner', 'School owner'),
    (v_school_id, 'swim_coach', 'Full coach'),
    (v_school_id, 'swim_coach_collaborator', 'Collaborator coach'),
    (v_school_id, 'swimmer', 'Athlete (reserved)');

  select id into v_owner_role_id
  from school_roles
  where school_id = v_school_id and name = 'swim_school_owner';

  insert into role_permissions (role_id, permission_id)
  select r.id, p.id
  from school_roles r
  cross join permissions p
  where r.school_id = v_school_id
    and (
      (r.name = 'swim_school_owner')
      or (r.name = 'swim_coach' and p.id in (
        'school:invite', 'school:members_manage',
        'session:create', 'session:edit',
        'drill:create', 'drill:edit',
        'library:manage',
        'swimmer:create', 'swimmer:edit', 'swimmer:view_school',
        'sync:use', 'insights:view', 'ai_coach:use'
      ))
      or (r.name = 'swim_coach_collaborator' and p.id in (
        'session:create', 'session:edit',
        'drill:create', 'drill:edit',
        'library:manage',
        'swimmer:create', 'swimmer:edit', 'swimmer:view_school',
        'sync:use'
      ))
      or (r.name = 'swimmer' and p.id in ('swimmer:self_view'))
    )
  on conflict do nothing;

  insert into school_memberships (user_id, school_id, role_id)
  values (v_user_id, v_school_id, v_owner_role_id)
  on conflict (user_id, school_id) do nothing;

  insert into feature_toggles (school_id, feature_key, enabled)
  select v_school_id, k.feature_key, true
  from (values
    ('sync'),
    ('collaboration'),
    ('insights'),
    ('ai_coach'),
    ('results_sync'),
    ('manual_export')
  ) as k(feature_key)
  on conflict (school_id, feature_key) do nothing;

  return v_school_id;
end;
$$;

create or replace function join_swim_school(p_code text, p_role_name text default 'swim_coach')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite school_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'invite code is required';
  end if;

  select * into v_invite
  from school_invites
  where code = upper(trim(p_code))
    and used_by is null
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'invalid or expired invite code';
  end if;

  if exists (
    select 1 from school_memberships
    where user_id = v_user_id and school_id = v_invite.school_id
  ) then
    return v_invite.school_id;
  end if;

  insert into school_memberships (user_id, school_id, role_id)
  select
    v_user_id,
    v_invite.school_id,
    sr.id
  from school_roles sr
  where sr.school_id = v_invite.school_id
    and sr.name = coalesce(nullif(p_role_name, ''), v_invite.role_name);

  if not found then
    raise exception 'role not found for school';
  end if;

  update school_invites
  set used_by = v_user_id, used_at = now()
  where id = v_invite.id;

  return v_invite.school_id;
end;
$$;

create or replace function create_school_invite(
  p_school_id uuid,
  p_role_name text default 'swim_coach',
  p_expires_days integer default 14
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not is_school_member(p_school_id) then
    raise exception 'not a member of this school';
  end if;

  if not user_has_permission(v_user_id, p_school_id, 'school:invite') then
    raise exception 'missing school:invite permission';
  end if;

  if p_role_name not in ('swim_coach', 'swim_coach_collaborator') then
    raise exception 'invite role must be swim_coach or swim_coach_collaborator';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into school_invites (school_id, code, role_name, created_by, expires_at)
  values (
    p_school_id,
    v_code,
    p_role_name,
    v_user_id,
    case when p_expires_days is null or p_expires_days <= 0 then null
         else now() + make_interval(days => p_expires_days) end
  );

  return v_code;
end;
$$;

grant execute on function create_swim_school(text) to authenticated;
grant execute on function join_swim_school(text, text) to authenticated;
grant execute on function create_school_invite(uuid, text, integer) to authenticated;
grant execute on function is_school_member(uuid) to authenticated;
grant execute on function user_has_permission(uuid, uuid, text) to authenticated;
