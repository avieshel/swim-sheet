-- Migration: 20261004000004_rename_school_to_organization.sql
-- Rename the tenant root from "swim_school" to "organization" for a generic,
-- future-proof, non-auth-colliding name. Purely mechanical: tables, columns,
-- indexes, trigger, helper functions, RPCs, RLS policies, and the seeded
-- role/permission/visibility data values are all updated in lockstep.
-- No structural change to the authorization model.

-- ── 1. Rename tables ─────────────────────────────────────────────────────
alter table swim_schools rename to organizations;
alter table school_roles rename to organization_roles;
alter table school_memberships rename to organization_memberships;
alter table school_invites rename to organization_invites;

-- ── 2. Rename the tenant column everywhere ───────────────────────────────
alter table swimmers rename column school_id to organization_id;
alter table sessions rename column school_id to organization_id;
alter table drills rename column school_id to organization_id;
alter table library_drills rename column school_id to organization_id;
alter table session_runs rename column school_id to organization_id;
alter table run_drills rename column school_id to organization_id;
alter table run_swimmers rename column school_id to organization_id;
alter table laps rename column school_id to organization_id;
alter table feature_toggles rename column school_id to organization_id;
alter table organization_roles rename column school_id to organization_id;
alter table organization_memberships rename column school_id to organization_id;
alter table organization_invites rename column school_id to organization_id;

-- ── 3. Rename indexes ────────────────────────────────────────────────────
alter index if exists idx_drills_school_id rename to idx_drills_organization_id;
alter index if exists idx_library_drills_school_id rename to idx_library_drills_organization_id;
alter index if exists idx_session_runs_school_id rename to idx_session_runs_organization_id;
alter index if exists idx_run_drills_school_id rename to idx_run_drills_organization_id;
alter index if exists idx_run_swimmers_school_id rename to idx_run_swimmers_organization_id;
alter index if exists idx_laps_school_id rename to idx_laps_organization_id;
alter index if exists idx_swimmers_school_id rename to idx_swimmers_organization_id;
alter index if exists idx_sessions_school_id rename to idx_sessions_organization_id;
alter index if exists idx_school_invites_school_id rename to idx_organization_invites_organization_id;

-- ── 4. Rename trigger (attached by OID; only the name is stale) ───────────
alter trigger swim_schools_set_updated_at on organizations rename to organizations_set_updated_at;

-- ── 5. Helper functions (bodies reference renamed tables/columns) ─────────
drop function if exists is_school_member(uuid) cascade;
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

drop function if exists user_has_permission(uuid, uuid, text) cascade;
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

grant execute on function is_organization_member(uuid) to authenticated;
grant execute on function user_has_permission(uuid, uuid, text) to authenticated;

-- ── 6. Tenant RPCs (recreated with renamed tables/columns/roles/perms) ────
drop function if exists create_swim_school(text);
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

drop function if exists join_swim_school(text, text);
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

drop function if exists create_school_invite(uuid, text, integer);
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

-- ── 7. Seeded data values (roles, permissions, visibility) ───────────────
-- Permissions catalog ids
update permissions set id = 'organization:manage' where id = 'school:manage';
update permissions set id = 'organization:invite' where id = 'school:invite';
update permissions set id = 'organization:members_manage' where id = 'school:members_manage';
update permissions set id = 'swimmer:view_organization' where id = 'swimmer:view_school';

update permissions set description = 'Manage organization settings, members, and features' where id = 'organization:manage';
update permissions set description = 'Invite coaches into the organization' where id = 'organization:invite';
update permissions set description = 'Change member roles or remove members' where id = 'organization:members_manage';
update permissions set description = 'View the organization roster' where id = 'swimmer:view_organization';

-- Role -> permission mapping (child side of the FK)
update role_permissions set permission_id = 'organization:manage' where permission_id = 'school:manage';
update role_permissions set permission_id = 'organization:invite' where permission_id = 'school:invite';
update role_permissions set permission_id = 'organization:members_manage' where permission_id = 'school:members_manage';
update role_permissions set permission_id = 'swimmer:view_organization' where permission_id = 'swimmer:view_school';

-- Role names
update organization_roles set name = 'owner' where name = 'swim_school_owner';
update organization_roles set name = 'coach' where name = 'swim_coach';
update organization_roles set name = 'collaborator' where name = 'swim_coach_collaborator';
update organization_roles set name = 'athlete' where name = 'swimmer';
update organization_roles set description = 'Organization owner' where name = 'owner';

-- Invite role_name default + any existing invites
alter table organization_invites alter column role_name set default 'coach';
update organization_invites set role_name = 'coach' where role_name = 'swim_coach';

-- Session visibility (added by 000003). Guarded so this migration is safe to
-- run even if 000003 was skipped or already partially applied.
alter table sessions add column if not exists visibility text not null default 'private';

update sessions set visibility = 'organization' where visibility = 'school';
comment on column sessions.visibility is 'private = only creator + organization:manage; organization = all organization members can view/use';

-- ── 8. Comments ──────────────────────────────────────────────────────────
comment on column organizations.created_by is 'Owner human who created the organization (owner membership also required).';

-- ── 9. RLS policies (recreated with renamed identifiers/columns/perms) ────
-- Organizations
drop policy if exists swim_schools_select on organizations;
create policy organizations_select on organizations
  for select to authenticated
  using (is_organization_member(id));

-- Organization roles
drop policy if exists school_roles_select on organization_roles;
create policy organization_roles_select on organization_roles
  for select to authenticated
  using (is_organization_member(organization_id));

-- Role permissions
drop policy if exists role_permissions_select on role_permissions;
create policy role_permissions_select on role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from organization_roles sr
      where sr.id = role_permissions.role_id
        and is_organization_member(sr.organization_id)
    )
  );

-- Organization memberships
drop policy if exists school_memberships_select on organization_memberships;
create policy organization_memberships_select on organization_memberships
  for select to authenticated
  using (user_id = auth.uid() or is_organization_member(organization_id));

drop policy if exists school_memberships_manage on organization_memberships;
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

-- Swimmers
drop policy if exists swimmers_select on swimmers;
create policy swimmers_select on swimmers
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

drop policy if exists swimmers_insert on swimmers;
create policy swimmers_insert on swimmers
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'swimmer:create')
  );

drop policy if exists swimmers_update on swimmers;
create policy swimmers_update on swimmers
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'swimmer:edit')
  );

drop policy if exists swimmers_delete on swimmers;
create policy swimmers_delete on swimmers
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'swimmer:remove')
  );

-- Sessions (delete from 000001; select/insert/update superseded by 000003)
drop policy if exists sessions_delete on sessions;
create policy sessions_delete on sessions
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'session:delete')
  );

drop policy if exists sessions_select on sessions;
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

drop policy if exists sessions_insert on sessions;
create policy sessions_insert on sessions
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), organization_id, 'session:create')
    and visibility in ('private', 'organization')
  );

drop policy if exists sessions_update on sessions;
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

-- Drills
drop policy if exists drills_select on drills;
create policy drills_select on drills
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

drop policy if exists drills_insert on drills;
create policy drills_insert on drills
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), organization_id, 'drill:create')
  );

drop policy if exists drills_update on drills;
create policy drills_update on drills
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'drill:edit')
  );

drop policy if exists drills_delete on drills;
create policy drills_delete on drills
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'drill:delete')
  );

-- Library drills
drop policy if exists library_drills_select on library_drills;
create policy library_drills_select on library_drills
  for select to authenticated
  using (organization_id is null or is_organization_member(organization_id));

drop policy if exists library_drills_insert on library_drills;
create policy library_drills_insert on library_drills
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), organization_id, 'library:manage')
  );

drop policy if exists library_drills_update on library_drills;
create policy library_drills_update on library_drills
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'library:manage')
  );

drop policy if exists library_drills_delete on library_drills;
create policy library_drills_delete on library_drills
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'library:delete')
  );

-- Session runs
drop policy if exists session_runs_select on session_runs;
create policy session_runs_select on session_runs
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

drop policy if exists session_runs_insert on session_runs;
create policy session_runs_insert on session_runs
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists session_runs_update on session_runs;
create policy session_runs_update on session_runs
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists session_runs_delete on session_runs;
create policy session_runs_delete on session_runs
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );

-- Run drills
drop policy if exists run_drills_select on run_drills;
create policy run_drills_select on run_drills
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

drop policy if exists run_drills_insert on run_drills;
create policy run_drills_insert on run_drills
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists run_drills_update on run_drills;
create policy run_drills_update on run_drills
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists run_drills_delete on run_drills;
create policy run_drills_delete on run_drills
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );

-- Run swimmers
drop policy if exists run_swimmers_select on run_swimmers;
create policy run_swimmers_select on run_swimmers
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

drop policy if exists run_swimmers_insert on run_swimmers;
create policy run_swimmers_insert on run_swimmers
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists run_swimmers_update on run_swimmers;
create policy run_swimmers_update on run_swimmers
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists run_swimmers_delete on run_swimmers;
create policy run_swimmers_delete on run_swimmers
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );

-- Laps
drop policy if exists laps_select on laps;
create policy laps_select on laps
  for select to authenticated
  using (organization_id is not null and is_organization_member(organization_id));

drop policy if exists laps_insert on laps;
create policy laps_insert on laps
  for insert to authenticated
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists laps_update on laps;
create policy laps_update on laps
  for update to authenticated
  using (organization_id is not null and is_organization_member(organization_id))
  with check (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists laps_delete on laps;
create policy laps_delete on laps
  for delete to authenticated
  using (
    organization_id is not null
    and is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );

-- Feature toggles
drop policy if exists feature_toggles_select on feature_toggles;
create policy feature_toggles_select on feature_toggles
  for select to authenticated
  using (is_organization_member(organization_id));

drop policy if exists feature_toggles_update on feature_toggles;
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

-- Organization invites
drop policy if exists school_invites_select on organization_invites;
create policy organization_invites_select on organization_invites
  for select to authenticated
  using (
    is_organization_member(organization_id)
    and user_has_permission(auth.uid(), organization_id, 'organization:invite')
  );

drop policy if exists school_invites_insert on organization_invites;
create policy organization_invites_insert on organization_invites
  for insert to authenticated
  with check (
    is_organization_member(organization_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), organization_id, 'organization:invite')
  );
