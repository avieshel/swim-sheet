create or replace function public.admin_create_session_bundle(
  p_organization_id uuid,
  p_coach_user_id uuid,
  p_session jsonb,
  p_drills jsonb,
  p_reject_name_conflict boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session_id uuid := gen_random_uuid();
  v_drill_id uuid;
  v_drill_ids uuid[] := '{}';
  v_drill jsonb;
  v_items jsonb;
  v_name text;
  v_lock_seed constant bigint := 0;
  v_now timestamptz := now();
begin
  if p_organization_id is null or p_coach_user_id is null then
    raise exception 'target scope is required';
  end if;

  if p_session is null or jsonb_typeof(p_session) <> 'object' then
    raise exception 'session must be an object';
  end if;

  if p_drills is null or jsonb_typeof(p_drills) <> 'array' then
    raise exception 'drills must be an array';
  end if;

  v_name := btrim(coalesce(p_session ->> 'name', ''));
  if v_name = '' then
    raise exception 'session name is required';
  end if;

  if p_session ? 'visibility'
    and p_session ->> 'visibility' not in ('private', 'organization') then
    raise exception 'session visibility is invalid';
  end if;

  if p_reject_name_conflict then
    perform pg_advisory_xact_lock(
      hashtextextended(
        p_organization_id::text || ':' || lower(v_name),
        v_lock_seed
      )
    );

    if exists (
      select 1
      from public.sessions
      where organization_id = p_organization_id
        and deleted_at is null
        and lower(btrim(name)) = lower(v_name)
    ) then
      return jsonb_build_object('outcome', 'name_conflict');
    end if;
  end if;

  insert into public.sessions (
    id,
    organization_id,
    created_by,
    name,
    notes,
    visibility,
    created_at,
    updated_at
  ) values (
    v_session_id,
    p_organization_id,
    p_coach_user_id,
    v_name,
    p_session ->> 'notes',
    coalesce(p_session ->> 'visibility', 'private'),
    v_now,
    v_now
  );

  for v_drill in
    select value from jsonb_array_elements(p_drills) as drill_rows(value)
  loop
    if jsonb_typeof(v_drill) <> 'object' then
      raise exception 'each drill must be an object';
    end if;

    if btrim(coalesce(v_drill ->> 'name', '')) = ''
      or coalesce(v_drill ->> 'stroke', '') = ''
      or v_drill ->> 'distance' is null
      or v_drill ->> 'drill_order' is null then
      raise exception 'drill name, stroke, distance, and order are required';
    end if;

    v_items := case
      when not (v_drill ? 'items') or v_drill -> 'items' = 'null'::jsonb then '[]'::jsonb
      when jsonb_typeof(v_drill -> 'items') = 'string' then (v_drill ->> 'items')::jsonb
      else v_drill -> 'items'
    end;

    if jsonb_typeof(v_items) <> 'array' then
      raise exception 'drill items must be an array';
    end if;

    v_drill_id := gen_random_uuid();
    insert into public.drills (
      id,
      organization_id,
      session_id,
      created_by,
      name,
      stroke,
      distance,
      drill_order,
      items,
      repeat_count,
      focus,
      labels,
      description,
      created_at,
      updated_at
    ) values (
      v_drill_id,
      p_organization_id,
      v_session_id,
      p_coach_user_id,
      btrim(v_drill ->> 'name'),
      v_drill ->> 'stroke',
      (v_drill ->> 'distance')::integer,
      (v_drill ->> 'drill_order')::integer,
      v_items,
      nullif(v_drill ->> 'repeat_count', '')::integer,
      v_drill ->> 'focus',
      coalesce(v_drill -> 'labels', '[]'::jsonb),
      coalesce(v_drill ->> 'description', ''),
      v_now,
      v_now
    );
    v_drill_ids := array_append(v_drill_ids, v_drill_id);
  end loop;

  return jsonb_build_object(
    'outcome', 'created',
    'sessionId', v_session_id,
    'drillIds', to_jsonb(v_drill_ids)
  );
end;
$$;

revoke all on function public.admin_create_session_bundle(uuid, uuid, jsonb, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_create_session_bundle(uuid, uuid, jsonb, jsonb, boolean)
  to service_role;
