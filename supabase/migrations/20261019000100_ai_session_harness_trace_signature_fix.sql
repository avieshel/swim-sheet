-- Corrective migration for ai_analytics_trace_insert.
--
-- The original 20261019000000 migration was recorded as applied, but its
-- ai_analytics_trace_insert function and grant were created with only 17
-- argument types — p_elapsed_ms integer was dropped from the signature. The
-- Edge Function RPC passes all 18 parameters (including p_elapsed_ms), so every
-- trace insert failed silently (the function with that exact signature did not
-- exist) and no row was ever written.
--
-- This migration removes the stale 17-argument overload (CREATE OR REPLACE
-- cannot change a function's parameter list) and recreates the function with
-- the correct 18-argument signature, then re-asserts the service_role-only
-- grant. It is idempotent: on a fresh apply the DROP is a no-op and the
-- CREATE OR REPLACE matches the corrected 20261019000000 definition.

-- Drop the stale 17-argument overload if it exists, so the recreate below is
-- unambiguous and the grant that follows targets exactly one function.
drop function if exists public.ai_analytics_trace_insert(
  uuid, uuid, uuid, text, text, text, text, integer, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz
);

create or replace function public.ai_analytics_trace_insert(
  p_user_id uuid,
  p_session_id uuid,
  p_trace_id uuid,
  p_model text,
  p_system_prompt text,
  p_user_content text,
  p_raw_content text,
  p_provider_status integer,
  p_finish_reason text,
  p_parsed_outcome text,
  p_error_kind text,
  p_error_message text,
  p_attempt_count integer,
  p_elapsed_ms integer,
  p_streamed boolean,
  p_started_at timestamptz,
  p_provider_called_at timestamptz,
  p_completed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ai_private, pg_temp
as $$
declare
  v_retention constant interval := interval '30 days';
begin
  delete from ai_private.ai_analytics_trace
  where created_at < now() - v_retention;

  insert into ai_private.ai_analytics_trace (
    user_id, session_id, trace_id, model, system_prompt, user_content,
    raw_content, provider_status, finish_reason, parsed_outcome, error_kind,
    error_message, attempt_count, elapsed_ms, streamed, started_at, provider_called_at, completed_at
  ) values (
    p_user_id, p_session_id, p_trace_id, p_model, p_system_prompt, p_user_content,
    p_raw_content, p_provider_status, p_finish_reason, p_parsed_outcome, p_error_kind,
    p_error_message, p_attempt_count, p_elapsed_ms, p_streamed, p_started_at, p_provider_called_at, p_completed_at
  );
end;
$$;

revoke execute on function public.ai_analytics_trace_insert(
  uuid, uuid, uuid, text, text, text, text, integer, text, text, text, text, integer, integer, boolean, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.ai_analytics_trace_insert(
  uuid, uuid, uuid, text, text, text, text, integer, text, text, text, text, integer, integer, boolean, timestamptz, timestamptz, timestamptz
) to service_role;
