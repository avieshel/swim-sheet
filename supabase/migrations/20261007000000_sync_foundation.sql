-- Migration: 20261007000000_sync_foundation.sql
-- Adds the sync foundation for cloud sync (offline-first):
--   * catalog_key columns on sessions / library_drills so identical starter
--     content ("Distance Progression", builtin drills) dedupes to ONE cloud row
--     across a user's devices instead of creating duplicates.
--   * Partial unique indexes enforcing one catalog row per organization.
--   * ensure_personal_organization() RPC: idempotently resolve (or create) the
--     signed-in user's single-member private organization, returning its id.

-- ── 1. catalog_key columns ──────────────────────────────────────────────────
alter table if exists sessions add column if not exists catalog_key text;
alter table if exists library_drills add column if not exists catalog_key text;

-- ── 2. Partial unique indexes (one catalog row per org) ─────────────────────
create unique index if not exists sessions_org_catalog_key_uniq
  on sessions (organization_id, catalog_key)
  where catalog_key is not null;

create unique index if not exists library_drills_org_catalog_key_uniq
  on library_drills (organization_id, catalog_key)
  where catalog_key is not null;

-- ── 3. ensure_personal_organization() ───────────────────────────────────────
-- Idempotent: returns the user's existing single-member org, else creates one
-- (organization + owner role + all permissions + membership). Reuses the owner
-- role / permission wiring established in 20261005001000_initial_schema.sql.
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

  -- Prefer an org the user owns (their private single-member org).
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
