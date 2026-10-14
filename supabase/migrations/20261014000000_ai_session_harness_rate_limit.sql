-- Private operational store for AI harness rate limiting.
--
-- Intentionally NOT a public table and NOT protected by RLS: the log lives in a
-- private schema and is only touched by the SECURITY DEFINER RPC below, which is
-- executable solely by the Edge Function's service-role client. This satisfies
-- the "no new public domain table or RLS policy" constraint while still keeping
-- the hourly per-user limit enforceable server-side.

create schema if not exists ai_private;

create table if not exists ai_private.ai_request_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_request_log_user_created_idx
  on ai_private.ai_request_log (user_id, created_at desc);

-- Atomic check-and-increment for one rolling hour window.
-- Returns allowed=false with a retry time once the per-user limit is reached.
create or replace function public.ai_request_record(p_user uuid)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ai_private, pg_temp
as $$
declare
  v_limit constant integer := 10;
  v_window constant interval := interval '1 hour';
  v_count integer;
  v_oldest timestamptz;
begin
  -- Drop entries outside the window so the table stays bounded.
  delete from ai_private.ai_request_log
  where created_at < now() - v_window;

  select count(*) into v_count
  from ai_private.ai_request_log
  where user_id = p_user and created_at > now() - v_window;

  if v_count >= v_limit then
    select min(created_at) into v_oldest
    from ai_private.ai_request_log
    where user_id = p_user and created_at > now() - v_window;
    return query select false,
      greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer);
    return;
  end if;

  insert into ai_private.ai_request_log (user_id) values (p_user);
  return query select true, 0;
end;
$$;

-- Only the service-role client may call the rate-limit RPC. Revoking from
-- PUBLIC (and the roles that inherit it) removes the default grant for
-- anon/authenticated; the explicit grant to service_role is what the Edge
-- Function uses.
revoke execute on function public.ai_request_record(uuid) from public, anon, authenticated;
grant execute on function public.ai_request_record(uuid) to service_role;
