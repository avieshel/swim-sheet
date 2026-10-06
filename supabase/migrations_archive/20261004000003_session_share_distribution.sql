-- Migration: 20261004000002_session_share_distribution.sql
-- Flexible identity model (confirmed cases):
--   1) Solo coach, multiple groups  -> swimmer.group + labels (no extra tenant)
--   2) Shared swim school / head coach -> membership + roles (existing)
--   3) Share or not share a session  -> sessions.visibility
--   4) Distribute sessions to coaches -> sessions.assigned_to
--   5) Weekly load per coach/school  -> session_runs.school_id (synced later)

alter table sessions
  add column if not exists visibility text not null default 'private',
  add column if not exists assigned_to uuid references profiles(id) on delete set null;

comment on column sessions.visibility is 'private = only creator + school:manage; school = all school members can view/use';
comment on column sessions.assigned_to is 'Optional coach profile id responsible for delivering this session (head-coach distribution).';

alter table swimmers
  add column if not exists labels jsonb;

comment on column swimmers.labels is 'Optional multi-tags (e.g. masters, private-lessons). group stays the primary bucket.';

-- Session visibility permission (catalog only; owner already has all via seed)
insert into permissions (id, description) values
  ('session:assign', 'Assign/distribute a session to a coach in the school')
on conflict (id) do update set description = excluded.description;

-- Grants for assigned_to / visibility columns already covered by table grants.

-- ── RLS: session visibility + assignment ──────────────────────────────

drop policy if exists sessions_select on sessions;
drop policy if exists sessions_insert on sessions;
drop policy if exists sessions_update on sessions;

create policy sessions_select on sessions
  for select to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and (
      visibility = 'school'
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or user_has_permission(auth.uid(), school_id, 'school:manage')
    )
  );

create policy sessions_insert on sessions
  for insert to authenticated
  with check (
    school_id is not null
    and is_school_member(school_id)
    and created_by = auth.uid()
    and user_has_permission(auth.uid(), school_id, 'session:create')
    and visibility in ('private', 'school')
  );

create policy sessions_update on sessions
  for update to authenticated
  using (
    school_id is not null
    and is_school_member(school_id)
    and (
      user_has_permission(auth.uid(), school_id, 'school:manage')
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or (
        visibility = 'school'
        and user_has_permission(auth.uid(), school_id, 'session:edit')
      )
    )
  )
  with check (
    school_id is not null
    and is_school_member(school_id)
    and visibility in ('private', 'school')
    and (
      user_has_permission(auth.uid(), school_id, 'school:manage')
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or (
        visibility = 'school'
        and user_has_permission(auth.uid(), school_id, 'session:edit')
      )
    )
  );

-- Owner-only delete unchanged (sessions_delete policy from previous migration).
