-- Local verification for the private AI rate-limit store.
--
-- Run against the local Supabase Postgres, e.g.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ai_rate_limit_check.sql
--
-- Exits non-zero (ON_ERROR_STOP) if any assertion fails.

do $$
declare
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_allowed boolean;
  v_retry integer;
  v_calls integer := 0;
  v_denied_at integer;
  v_anon_ok boolean;
  v_auth_ok boolean;
  v_svc_ok boolean;
begin
  -- Ensure a clean slate for the test user.
  delete from ai_private.ai_request_log where user_id = v_user;

  -- First 10 calls are allowed; the 11th is denied with a positive retry time.
  v_denied_at := 0;
  for i in 1..11 loop
    select allowed, retry_after_seconds
      into v_allowed, v_retry
      from public.ai_request_record(v_user);
    if v_allowed then
      v_calls := v_calls + 1;
    else
      v_denied_at := i;
      exit;
    end if;
  end loop;

  assert v_calls = 10, format('expected 10 allowed calls, got %s', v_calls);
  assert v_denied_at = 11, format('expected denial on the 11th call, got denial at %s', v_denied_at);
  assert v_retry > 0, format('expected positive retry_after_seconds, got %s', v_retry);

  -- Permission checks: anon/authenticated cannot call it; service_role can.
  select has_function_privilege('anon', 'public.ai_request_record(uuid)'::regprocedure, 'execute')
    into v_anon_ok;
  select has_function_privilege('authenticated', 'public.ai_request_record(uuid)'::regprocedure, 'execute')
    into v_auth_ok;
  select has_function_privilege('service_role', 'public.ai_request_record(uuid)'::regprocedure, 'execute')
    into v_svc_ok;

  assert not v_anon_ok, 'anon must NOT be able to execute ai_request_record';
  assert not v_auth_ok, 'authenticated must NOT be able to execute ai_request_record';
  assert v_svc_ok, 'service_role must be able to execute ai_request_record';

  -- The private table must not live in the public (API-exposed) schema.
  assert (
    select count(*) = 0 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'ai_request_log'
  ), 'ai_request_log must not be exposed in the public schema';

  raise notice 'ai_rate_limit_check: all assertions passed';
end $$;
