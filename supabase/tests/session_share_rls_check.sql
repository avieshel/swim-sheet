-- Session share/assignment RLS verification (local Supabase)
-- psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/session_share_rls_check.sql

begin;

delete from sessions where school_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
delete from swimmers where school_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
delete from school_memberships where school_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
delete from role_permissions where role_id in (
  'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
delete from school_roles where id in (
  'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
delete from swim_schools where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@school-a.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coach@school-a.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coach@school-b.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into profiles (id, email, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'owner@school-a.test', 'Owner A'),
  ('22222222-2222-2222-2222-222222222222', 'coach@school-a.test', 'Coach A'),
  ('33333333-3333-3333-3333-333333333333', 'coach@school-b.test', 'Coach B')
on conflict (id) do nothing;

insert into swim_schools (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'School A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'School B', '33333333-3333-3333-3333-333333333333')
on conflict (id) do nothing;

insert into school_roles (id, school_id, name, description) values
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'swim_school_owner', 'School owner'),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'swim_coach', 'Full coach'),
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'swim_school_owner', 'School owner')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from school_roles r
cross join permissions p
where (r.school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and r.name = 'swim_school_owner')
   or (r.school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and r.name = 'swim_school_owner')
on conflict do nothing;

-- Coach A: session create/edit, swimmer view/create/edit, sync — no deletes, no school:manage
insert into role_permissions (role_id, permission_id)
select 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', p.id
from (values
  ('session:create'), ('session:edit'), ('drill:create'), ('drill:edit'),
  ('library:manage'), ('swimmer:create'), ('swimmer:edit'), ('swimmer:view_school'), ('sync:use')
) as t(permission_id)
join permissions p on p.id = t.permission_id
on conflict do nothing;

insert into school_memberships (user_id, school_id, role_id) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
on conflict (user_id, school_id) do nothing;

insert into sessions (id, school_id, name, visibility, assigned_to, created_by) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Private session', 'private', null, '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Shared session', 'school', null, '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Assigned session', 'private', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

insert into swimmers (id, school_id, name, group_name, labels, created_by) values
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Masters Swimmer', 'masters', '["masters","private-lessons"]', '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions' and column_name = 'visibility'
  ) then raise exception 'sessions.visibility missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions' and column_name = 'assigned_to'
  ) then raise exception 'sessions.assigned_to missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'swimmers' and column_name = 'labels'
  ) then raise exception 'swimmers.labels missing'; end if;
end $$;

set local role authenticated;

-- Coach A: member of School A
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$
declare n bigint;
begin
  select count(*) into n from sessions where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if n <> 2 then
    raise exception 'coach A expected 2 visible sessions (school+assigned), got %', n;
  end if;
  if exists (select 1 from sessions where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') then
    raise exception 'coach A should not see owner private session';
  end if;
  if not exists (select 1 from sessions where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') then
    raise exception 'coach A missing school-visible session';
  end if;
  if not exists (select 1 from sessions where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') then
    raise exception 'coach A missing assigned session';
  end if;

  select count(*) into n from sessions where school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if n <> 0 then
    raise exception 'coach A leaked cross-tenant sessions: %', n;
  end if;

  if not exists (
    select 1 from swimmers
    where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and labels::text like '%private-lessons%'
  ) then
    raise exception 'coach A missing swimmer labels';
  end if;
end $$;

-- Coach B: other school
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
do $$
declare n bigint;
begin
  select count(*) into n from sessions where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if n <> 0 then
    raise exception 'coach B leaked School A sessions: %', n;
  end if;
  select count(*) into n from swimmers where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if n <> 0 then
    raise exception 'coach B leaked School A swimmers: %', n;
  end if;
end $$;

-- Owner A
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
do $$
declare n bigint;
begin
  select count(*) into n from sessions where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if n <> 3 then
    raise exception 'owner A expected 3 sessions, got %', n;
  end if;
end $$;

-- Anonymous
select set_config('request.jwt.claim.sub', '', true);
do $$
declare n bigint;
begin
  select count(*) into n from sessions;
  if n <> 0 then
    raise exception 'anon leaked sessions: %', n;
  end if;
end $$;

select 'SESSION_SHARE_RLS_OK' as result;

rollback;
