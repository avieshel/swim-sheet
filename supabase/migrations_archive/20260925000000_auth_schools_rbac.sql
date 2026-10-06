-- Migration: 20260925000000_auth_schools_rbac.sql
-- Enables multi-tenant swim schools, RBAC permissions, and privacy/GDPR support

-- 1. Profiles (Global user metadata linked to Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- 2. Swim Schools (The CRM Account Entity)
create table swim_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 3. School Roles (Scoping roles per school)
create table school_roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references swim_schools(id) on delete cascade,
  name text not null, -- e.g., 'Head Coach', 'Assistant Trainer'
  description text,
  unique (school_id, name)
);

-- 4. Atomic Permissions Catalog
create table permissions (
  id text primary key, -- e.g., 'session:create', 'session:edit_all', 'swimmer:manage'
  description text
);

-- Seed default permissions
insert into permissions (id, description) values
  ('school:manage', 'Manage school settings and roles'),
  ('session:create', 'Create new session templates'),
  ('session:edit_all', 'Edit any session in the school'),
  ('session:edit_own', 'Edit own sessions'),
  ('swimmer:manage', 'Add, edit, or remove roster swimmers');

-- 5. Role Permissions Mapping
create table role_permissions (
  role_id uuid references school_roles(id) on delete cascade,
  permission_id text references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- 6. School Memberships (Connecting Users to Schools with specific Roles)
create table school_memberships (
  user_id uuid references profiles(id) on delete cascade,
  school_id uuid references swim_schools(id) on delete cascade,
  role_id uuid references school_roles(id) on delete cascade,
  primary key (user_id, school_id)
);

-- 7. Swimmers (Roster associated with a school, optionally linked to a user account)
create table swimmers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references swim_schools(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  name text not null,
  group_name text,
  notes text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Sessions (Owned by school and created by a user)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references swim_schools(id) on delete cascade,
  created_by uuid references profiles(id) on delete cascade,
  name text not null,
  notes text,
  pool_length integer default 25,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 9. Helper RPC function for checking permissions in RLS / Edge Functions
create or replace function user_has_permission(p_user_id uuid, p_school_id uuid, p_permission text)
returns boolean language sql security definer as $$
  select exists (
    select 1 from school_memberships sm
    join role_permissions rp on rp.role_id = sm.role_id
    where sm.user_id = p_user_id
      and sm.school_id = p_school_id
      and rp.permission_id = p_permission
  );
$$;

-- 10. GDPR Helper: Anonymize Swimmer PII
create or replace function anonymize_swimmer(p_swimmer_id uuid)
returns void language sql security definer as $$
  update swimmers 
  set name = 'Anonymous Athlete', 
      notes = null, 
      user_id = null,
      status = 'archived',
      updated_at = now()
  where id = p_swimmer_id;
$$;
