-- Migration: 20261008000000_ensure_personal_organization_lock.sql
-- Serializes ensure_personal_organization() so concurrent callers cannot each
-- create their own organization.
--
-- Bug found by tests/sync-cross-device.spec.ts against local Docker: the
-- function did a check-then-insert with nothing serializing the two steps. Two
-- devices signing in at nearly the same instant both read "no existing org"
-- and both inserted. Five concurrent calls produced five organizations for one
-- user, so each device landed in a different org and never saw the other's rows
-- (device 2 pulled an empty org).
--
-- pg_advisory_xact_lock is held until the transaction ends, and is released
-- automatically on commit or rollback, so it cannot leak. hashtextextended
-- gives a stable bigint key per user.

create or replace function ensure_personal_organization()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_owner_role_id uuid;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Serialize on the user id before the check-then-insert below.
  perform pg_advisory_xact_lock(hashtextextended('personal_org:' || v_user_id::text, 0));

  select o.id into v_org_id
  from organizations o
  join organization_memberships om on om.organization_id = o.id
  where om.user_id = v_user_id
    and o.created_by = v_user_id
  limit 1;

  if v_org_id is not null then
    return v_org_id;
  end if;

  select coalesce(full_name, 'Personal') into v_name from profiles where id = v_user_id;

  insert into organizations (name, created_by)
  values (v_name || '''s Organization', v_user_id)
  returning id into v_org_id;

  insert into organization_roles (organization_id, name, description)
  values (v_org_id, 'owner', 'Organization owner');

  select id into v_owner_role_id
  from organization_roles
  where organization_id = v_org_id and name = 'owner';

  insert into role_permissions (role_id, permission_id)
  select v_owner_role_id, id from permissions;

  insert into organization_memberships (user_id, organization_id, role_id)
  values (v_user_id, v_org_id, v_owner_role_id)
  on conflict (user_id, organization_id) do nothing;

  return v_org_id;
end;
$$;

grant execute on function ensure_personal_organization() to authenticated;
revoke execute on function ensure_personal_organization() from public, anon;