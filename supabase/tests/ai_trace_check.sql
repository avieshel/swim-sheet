-- Local verification for the owner-only AI-analytics trace.
--
-- Run against the local Supabase Postgres, e.g.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ai_trace_check.sql
--
-- Exits non-zero (ON_ERROR_STOP) if any assertion fails.

do $$
declare
  v_user uuid := '22222222-2222-2222-2222-222222222222';
  v_anon_ok boolean;
  v_auth_ok boolean;
  v_svc_ok boolean;
  v_trace_id uuid := '33333333-3333-3333-3333-333333333333';
begin
  -- Ensure a clean slate for the test user.
  delete from ai_private.ai_request_trace where user_id = v_user;

  -- Insert one row via the RPC (as the service_role caller would).
  perform public.ai_request_trace_insert(
    v_user, null, v_trace_id,
    'gpt-4o-mini',
    'system prompt',
    'Prompt: a set',
    '{"outcome":"draft"}',
    200, null, 'draft', 'none', null,
    1234, false,
    now(), now(), now()
  );

  assert (
    select count(*) = 1 from ai_private.ai_request_trace where user_id = v_user
  ), 'expected exactly one trace row to be inserted';

  assert (
    select count(*) = 0 from ai_private.ai_request_trace where id is null
  ), 'trace row must have an identity id';

  -- Permission checks: anon/authenticated cannot call it; service_role can.
  select has_function_privilege('anon', 'public.ai_request_trace_insert(uuid,uuid,uuid,text,text,text,text,integer,text,text,text,text,integer,boolean,timestamptz,timestamptz,timestamptz)'::regprocedure, 'execute')
    into v_anon_ok;
  select has_function_privilege('authenticated', 'public.ai_request_trace_insert(uuid,uuid,uuid,text,text,text,text,integer,text,text,text,text,integer,boolean,timestamptz,timestamptz,timestamptz)'::regprocedure, 'execute')
    into v_auth_ok;
  select has_function_privilege('service_role', 'public.ai_request_trace_insert(uuid,uuid,uuid,text,text,text,text,integer,text,text,text,text,integer,boolean,timestamptz,timestamptz,timestamptz)'::regprocedure, 'execute')
    into v_svc_ok;

  assert not v_anon_ok, 'anon must NOT be able to execute ai_request_trace_insert';
  assert not v_auth_ok, 'authenticated must NOT be able to execute ai_request_trace_insert';
  assert v_svc_ok, 'service_role must be able to execute ai_request_trace_insert';

  -- The private table must not live in the public (API-exposed) schema.
  assert (
    select count(*) = 0 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'ai_request_trace'
  ), 'ai_request_trace must not be exposed in the public schema';

  raise notice 'ai_trace_check: all assertions passed';
end $$;
