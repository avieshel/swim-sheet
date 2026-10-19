-- Owner-only AI-analytics trace for the session-draft harness.
--
-- Mirrors the existing ai_private.ai_request_log posture: a private schema, a
-- table, and a SECURITY DEFINER RPC executable solely by the Edge Function's
-- service-role client. The app owner queries ai_private.ai_request_trace directly
-- (SQL / dashboard) to see what was sent to and returned by the model, and why a
-- request failed (e.g. timeouts). Not exposed to clients, no RLS.

create schema if not exists ai_private;

create table if not exists ai_private.ai_request_trace (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null,
  analytics_session_id uuid,
  trace_id uuid,
  model text not null,
  system_prompt text not null,
  user_content text not null,
  raw_content text,
  provider_status integer,
  finish_reason text,
  parsed_outcome text,
  error_kind text,
  error_message text,
  elapsed_ms integer not null,
  streamed boolean not null,
  started_at timestamptz not null,
  provider_called_at timestamptz,
  completed_at timestamptz not null
);

create index if not exists ai_request_trace_user_created_idx
  on ai_private.ai_request_trace (user_id, created_at desc);
create index if not exists ai_request_trace_session_idx
  on ai_private.ai_request_trace (analytics_session_id);
create index if not exists ai_request_trace_trace_idx
  on ai_private.ai_request_trace (trace_id);

-- Insert a single trace row. Parameterized per column so the caller passes a
-- typed record rather than opaque jsonb.
create or replace function public.ai_request_trace_insert(
  p_user_id uuid,
  p_analytics_session_id uuid,
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
begin
  insert into ai_private.ai_request_trace (
    user_id, analytics_session_id, trace_id, model, system_prompt, user_content,
    raw_content, provider_status, finish_reason, parsed_outcome, error_kind,
    error_message, elapsed_ms, streamed, started_at, provider_called_at, completed_at
  ) values (
    p_user_id, p_analytics_session_id, p_trace_id, p_model, p_system_prompt, p_user_content,
    p_raw_content, p_provider_status, p_finish_reason, p_parsed_outcome, p_error_kind,
    p_error_message, p_elapsed_ms, p_streamed, p_started_at, p_provider_called_at, p_completed_at
  );
end;
$$;

revoke execute on function public.ai_request_trace_insert(
  uuid, uuid, uuid, text, text, text, text, integer, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.ai_request_trace_insert(
  uuid, uuid, uuid, text, text, text, text, integer, text, text, text, text, integer, boolean, timestamptz, timestamptz, timestamptz
) to service_role;
