-- Migration: 20261005001000_initial_schema.sql
-- Consolidated INITIAL schema for SwimSheet (private beta, Supabase-backed).
-- Tenant root is "organization" (not swim_school / account) — chosen to be
-- generic and to avoid colliding with auth-account terminology.
--
-- This is the single source of truth for a fresh project. Delete every other
-- file in supabase/migrations/ (or move them to supabase/migrations_archive/)
-- and apply this one file. It is idempotent-safe for tables/indexes via
-- IF NOT EXISTS so a re-run on an already-applied fresh DB will not error on
-- those; policies assume a fresh apply.
--
-- Structure:
--   profiles (1:1 with auth.users)
--   organizations (tenant root)
--   organization_roles / permissions / role_permissions / organization_memberships (RBAC)
--   feature_toggles, organization_invites
--   swimmers, sessions, drills, library_drills, session_runs, run_drills,
--   run_swimmers, laps (domain tables, all tenant-scoped by organization_id)
--   analytics_events (telemetry sink)
--   helper functions, auth trigger, tenant RPCs, RLS policies, grants

-- ── 0. Extensions ───────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- Defensive: drop any legacy swim_school-shaped tables so this single migration
-- can be (re)applied over a DB that still carries the old staged schema
-- (swim_schools / school_*). Cascade removes the old-shaped domain tables that
-- referenced swim_schools. Safe no-op on a fresh DB.
drop table if exists swim_schools cascade;

-- ── 1. Profiles ─────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- ── 2. Organizations (tenant root) ──────────────────────────────────────
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);
comment on column organizations.created_by is 'Owner human who created the organization (owner membership also required).';

-- ── 3. RBAC catalog ─────────────────────────────────────────────────────
create table if not exists organization_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  unique (organization_id, name)
);

create table if not exists permissions (
  id text primary key,
  description text
);

create table if not exists role_permissions (
  role_id uuid references organization_roles(id) on delete cascade,
  permission_id text references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists organization_memberships (
  user_id uuid references profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  role_id uuid references organization_roles(id) on delete cascade,
  primary key (user_id, organization_id)
);

-- ── 4. Feature toggles (default open; owner can flip later) ─────────────
create table if not exists feature_toggles (
  organization_id uuid not null references organizations(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature_key)
);

-- ── 5. Organization invites ─────────────────────────────────────────────
create table if not exists organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null unique,
  role_name text not null default 'coach',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by uuid references profiles(id) on delete set null,
  used_at timestamptz
);
create index if not exists idx_organization_invites_organization_id on organization_invites(organization_id);

-- ── 6. Domain tables (all tenant-scoped by organization_id) ─────────────
create table if not exists swimmers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  name text not null,
  group_name text,
  notes text,
  labels jsonb,
  status text default 'active',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on column swimmers.labels is 'Optional multi-tags (e.g. masters, private-lessons). group stays the primary bucket.';

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid references profiles(id) on delete cascade,
  name text not null,
  notes text,
  visibility text not null default 'private',
  assigned_to uuid references profiles(id) on delete set null,
  pool_length integer default 25,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on column sessions.visibility is 'private = only creator + organization:manage; organization = all organization members can view/use';
comment on column sessions.assigned_to is 'Optional coach profile id responsible for delivering this session (head-coach distribution).';

create table if not exists drills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
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

create table if not exists library_drills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
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

create table if not exists session_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
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

create table if not exists run_drills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
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

create table if not exists run_swimmers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  run_id uuid not null references session_runs(id) on delete cascade,
  swimmer_id uuid not null references swimmers(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  lane integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists laps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
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

-- Domain indexes
create index if not exists idx_swimmers_organization_id on swimmers(organization_id);
create index if not exists idx_swimmers_updated_at on swimmers(updated_at);
create index if not exists idx_sessions_organization_id on sessions(organization_id);
create index if not exists idx_sessions_created_by on sessions(created_by);
create index if not exists idx_sessions_updated_at on sessions(updated_at);
create index if not exists idx_drills_organization_id on drills(organization_id);
create index if not exists idx_drills_session_id on drills(session_id);
create index if not exists idx_drills_updated_at on drills(updated_at);
create index if not exists idx_library_drills_organization_id on library_drills(organization_id);
create index if not exists idx_library_drills_updated_at on library_drills(updated_at);
create index if not exists idx_session_runs_organization_id on session_runs(organization_id);
create index if not exists idx_session_runs_session_id on session_runs(session_id);
create index if not exists idx_session_runs_updated_at on session_runs(updated_at);
create index if not exists idx_run_drills_organization_id on run_drills(organization_id);
create index if not exists idx_run_drills_run_id on run_drills(run_id);
create index if not exists idx_run_swimmers_organization_id on run_swimmers(organization_id);
create index if not exists idx_run_swimmers_run_id on run_swimmers(run_id);
create index if not exists idx_run_swimmers_swimmer_id on run_swimmers(swimmer_id);
create index if not exists idx_laps_organization_id on laps(organization_id);
create index if not exists idx_laps_run_drill_id on laps(run_drill_id);
create index if not exists idx_laps_swimmer_id on laps(swimmer_id);

-- ── 7. Analytics events (telemetry sink) ────────────────────────────────
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  device_id text not null,
  event_name text not null,
  properties jsonb not null default '{}',
  app_version text,
  platform text,
  created_at timestamptz default now(),
  session_id uuid,
  timestamp bigint,
  device_created_tstamp bigint,
  device_sent_tstamp bigint,
  device_local_tstamp bigint,
  timezone text,
  event_id uuid,
  device_country text,
  device_language text,
  device_os text,
  device_type text,
  device_screen text,
  device_connection text
);
create index if not exists idx_analytics_events_device_session on analytics_events (device_id, session_id);
create index if not exists idx_analytics_events_timestamp on analytics_events (timestamp);
create unique index if not exists idx_analytics_events_event_id on analytics_events (event_id);

-- ── 8. Permission catalog (frozen matrix) ───────────────────────────────
-- Remove any legacy school:* / swimmer:view_school rows left over from an old
-- schema so the catalog stays clean. No-op on a fresh DB.
delete from role_permissions where permission_id like 'school:%' or permission_id = 'swimmer:view_school';
delete from permissions where id like 'school:%' or id = 'swimmer:view_school';

insert into permissions (id, description) values
  ('organization:manage', 'Manage organization settings, members, and features'),
  ('organization:invite', 'Invite coaches into the organization'),
  ('organization:members_manage', 'Change member roles or remove members'),
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
  ('swimmer:view_organization', 'View the organization roster'),
  ('session:assign', 'Assign/distribute a session to a coach in the organization'),
  ('sync:use', 'Use cloud sync for organization data'),
  ('insights:view', 'View insights and analytics'),
  ('ai_coach:use', 'Use the AI coach agent'),
  ('swimmer:self_view', 'Athlete self-view (reserved, future role)')
on conflict (id) do update set description = excluded.description;

-- ── 9. Shared helper functions ──────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function is_organization_member(p_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships
    where user_id = auth.uid()
      and organization_id = p_organization
  );
$$;

create or replace function user_has_permission(p_user_id uuid, p_organization_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships sm
    join role_permissions rp on rp.role_id = sm.role_id
    where sm.user_id = p_user_id
      and sm.organization_id = p_organization_id
      and rp.permission_id = p_permission
  );
$$;

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

create or replace function anonymize_swimmer(p_swimmer_id uuid)
returns void
language sql
security definer
as $$
  update swimmers
  set name = 'Anonymous Athlete',
      notes = null,
      user_id = null,
      status = 'archived',
      updated_at = now()
  where id = p_swimmer_id;
$$;

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

-- ── 10. updated_at triggers ─────────────────────────────────────────────
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

drop trigger if exists organizations_set_updated_at on organizations;
create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

drop trigger if exists feature_toggles_set_updated_at on feature_toggles;
create trigger feature_toggles_set_updated_at
  before update on feature_toggles
  for each row execute function set_updated_at();

-- ── 11. Auth trigger: profile on signup ─────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 12. Tenant RPCs ─────────────────────────────────────────────────────
create or replace function create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_owner_role_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  insert into organizations (name, created_by)
  values (trim(p_name), v_user_id)
  returning id into v_organization_id;

  insert into organization_roles (organization_id, name, description)
  values
    (v_organization_id, 'owner', 'Organization owner'),
    (v_organization_id, 'coach', 'Full coach'),
    (v_organization_id, 'collaborator', 'Collaborator coach'),
    (v_organization_id, 'athlete', 'Athlete (reserved)');

  select id into v_owner_role_id
  from organization_roles
  where organization_id = v_organization_id and name = 'owner';

  insert into role_permissions (role_id, permission_id)
  select r.id, p.id
  from organization_roles r
  cross join permissions p
  where r.organization_id = v_organization_id
    and (
      (r.name = 'owner')
      or (r.name = 'coach' and p.id in (
        'organization:invite', 'organization:members_manage',
        'session:create', 'session:edit',
        'drill:create', 'drill:edit',
        'library:manage',
        'swimmer:create', 'swimmer:edit', 'swimmer:view_organization',
        'sync:use', 'insights:view', 'ai_coach:use'
      ))
      or (r.name = 'collaborator' and p.id in (
        'session:create', 'session:edit',
        'drill:create', 'drill:edit',
        'library:manage',
        'swimmer:create', 'swimmer:edit', 'swimmer:view_organization',
        'sync:use'
      ))
      or (r.name = 'athlete' and p.id in ('swimmer:self_view'))
    )
  on conflict do nothing;

  insert into organization_memberships (user_id, organization_id, role_id)
  values (v_user_id, v_organization_id, v_owner_role_id)
  on conflict (user_id, organization_id) do nothing;

  insert into feature_toggles (organization_id, feature_key, enabled)
  select v_organization_id, k.feature_key, true
  from (values
    ('sync'),
    ('collaboration'),
    ('insights'),
    ('ai_coach'),
    ('results_sync'),
    ('manual_export')
  ) as k(feature_key)
  on conflict (organization_id, feature_key) do nothing;

  return v_organization_id;
end;
$$;

create or replace function join_organization(p_code text, p_role_name text default 'coach')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite organization_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'invite code is required';
  end if;

  select * into v_invite
  from organization_invites
  where code = upper(trim(p_code))
    and used_by is null
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'invalid or expired invite code';
  end if;

  if exists (
    select 1 from organization_memberships
    where user_id = v_user_id and organization_id = v_invite.organization_id
  ) then
    return v_invite.organization_id;
  end if;

  insert into organization_memberships (user_id, organization_id, role_id)
  select
    v_user_id,
    v_invite.organization_id,
    sr.id
  from organization_roles sr
  where sr.organization_id = v_invite.organization_id
    and sr.name = coalesce(nullif(p_role_name, ''), v_invite.role_name);

  if not found then
    raise exception 'role not found for organization';
  end if;

  update organization_invites
  set used_by = v_user_id, used_at = now()
  where id = v_invite.id;

  return v_invite.organization_id;
end;
$$;

create or replace function create_organization_invite(
  p_organization_id uuid,
  p_role_name text default 'coach',
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

  if not is_organization_member(p_organization_id) then
    raise exception 'not a member of this organization';
  end if;

  if not user_has_permission(v_user_id, p_organization_id, 'organization:invite') then
    raise exception 'missing organization:invite permission';
  end if;

  if p_role_name not in ('coach', 'collaborator') then
    raise exception 'invite role must be coach or collaborator';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into organization_invites (organization_id, code, role_name, created_by, expires_at)
  values (
    p_organization_id,
    v_code,
    p_role_name,
    v_user_id,
    case when p_expires_days is null or p_expires_days <= 0 then null
         else now() + make_interval(days => p_expires_days) end
  );

  return v_code;
end;
$$;

grant execute on function create_organization(text) to authenticated;
grant execute on function join_organization(text, text) to authenticated;
grant execute on function create_organization_invite(uuid, text, integer) to authenticated;
grant execute on function is_organization_member(uuid) to authenticated;
grant execute on function user_has_permission(uuid, uuid, text) to authenticated;

-- ── 13. Enable RLS ──────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table organization_roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table organization_memberships enable row level security;
alter table swimmers enable row level security;
alter table sessions enable row level security;
alter table drills enable row level security;
alter table library_drills enable row level security;
alter table session_runs enable row level security;
alter table run_drills enable row level security;
alter table run_swimmers enable row level security;
alter table laps enable row level security;
alter table feature_toggles enable row level security;
alter table organization_invites enable row level security;
alter table analytics_events enable row level security;

-- ── 14. RLS policies ────────────────────────────────────────────────────

-- profiles: self only
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

-- catalogs: readable when authenticated (no PII)
create policy permissions_select on permissions
  for select to authenticated
  using (true);

create policy organizations_select on organizations
  for select to authenticated
  using (is_organization_member(id));

create policy organization_roles_select on organization_roles
  for select to authenticated
  using (is_organization_member(organization_id));

create policy role_permissions_select on role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from organization_roles sr
      where sr.id = role_permissions.role_id
        and is_organization_member(sr.organization_id)
    )
  );

-- organization_memberships
create policy organization_memberships_select on organization_memberships
  for select to authenticated
  using (user_id = auth.uid() or is_organization_member(organization_id));

create policy organization_memberships_manage on organization_memberships
  for all to authenticated
  using (
    is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:members_manage')
  )
  with check (
    is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:members_manage')
  );

-- swimmers
create policy swimmers_select on swimmers
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

create policy swimmers_insert on swimmers
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'swimmer:create')
  );

create policy swimmers_update on swimmers
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'swimmer:edit')
  );

create policy swimmers_delete on swimmers
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'swimmer:remove')
  );

-- sessions
create policy sessions_select on sessions
  for select to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and (
      visibility = 'organization'
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or user_has_permission(auth.uid(), organization_id, 'organization:manage')
    )
  );

create policy sessions_insert on sessions
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), organization_id, 'session:create')
    and visibility in ('private', 'organization')
  );

create policy sessions_update on sessions
  for update to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and (
      user_has_permission(auth.uid(), organization_id, 'organization:manage')
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or (
        visibility = 'organization'
        and user_has_permission(auth.uid(), organization_id, 'session:edit')
      )
    )
  )
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and visibility in ('private', 'organization')
    and (
      user_has_permission(auth.uid(), organization_id, 'organization:manage')
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or (
        visibility = 'organization'
        and user_has_permission(auth.uid(), organization_id, 'session:edit')
      )
    )
  );

create policy sessions_delete on sessions
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'session:delete')
  );

-- drills
create policy drills_select on drills
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

create policy drills_insert on drills
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), organization_id, 'drill:create')
  );

create policy drills_update on drills
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'drill:edit')
  );

create policy drills_delete on drills
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'drill:delete')
  );

-- library_drills (null organization_id = shared builtin, read-only)
create policy library_drills_select on library_drills
  for select to authenticated
  using (organization_id is null or is_organization_member(organization_id));

create policy library_drills_insert on library_drills
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), organization_id, 'library:manage')
  );

create policy library_drills_update on library_drills
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'library:manage')
  );

create policy library_drills_delete on library_drills
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'library:delete')
  );

-- session_runs / run_drills / run_swimmers / laps
create policy session_runs_select on session_runs
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

create policy session_runs_insert on session_runs
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

create policy session_runs_update on session_runs
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

create policy session_runs_delete on session_runs
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );

create policy run_drills_select on run_drills
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

create policy run_drills_insert on run_drills
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

create policy run_drills_update on run_drills
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

create policy run_drills_delete on run_drills
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );

create policy run_swimmers_select on run_swimmers
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

create policy run_swimmers_insert on run_swimmers
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

create policy run_swimmers_update on run_swimmers
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

create policy run_swimmers_delete on run_swimmers
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );

create policy laps_select on laps
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

create policy laps_insert on laps
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

create policy laps_update on laps
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

create policy laps_delete on laps
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );

-- feature_toggles: members read; owner (organization:manage) writes
create policy feature_toggles_select on feature_toggles
  for select to authenticated
  using (is_organization_member(organization_id));

create policy feature_toggles_update on feature_toggles
  for update to authenticated
  using (
    is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  )
  with check (
    is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );

-- organization_invites
create policy organization_invites_select on organization_invites
  for select to authenticated
  using (
    is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:invite')
  );

create policy organization_invites_insert on organization_invites
  for insert to authenticated
  with check (
    is_organization_member(organization_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), organization_id, 'organization:invite')
  );

-- analytics_events: any client may insert telemetry; only service_role reads;
-- authenticated users may read only their own rows.
create policy "Allow insert telemetry for all"
  on analytics_events for insert
  with check (true);

create policy "Restrict analytics read to service role"
  on analytics_events for select
  using (false);

create policy analytics_events_select_own on analytics_events
  for select to authenticated
  using (user_id = auth.uid());

-- ── 15. Analytics insert grants ─────────────────────────────────────────
grant insert on analytics_events to anon, authenticated;
