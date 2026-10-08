-- Security baseline verification (local Supabase)
-- psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rls_hardening_check.sql
--
-- Guards the invariants the initial migration must always satisfy, so a
-- partially applied or hand-edited schema fails loudly instead of silently
-- shipping with RLS gaps or anon-callable SECURITY DEFINER functions.

begin;

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  loop
    raise exception 'RLS_DISABLED: public.% has row level security off', r.relname;
  end loop;

  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
      )
  loop
    raise exception 'NO_POLICY: public.% has RLS enabled but no policy', r.relname;
  end loop;

  for r in
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and not exists (
        select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'
      )
  loop
    raise exception 'UNPINNED_SEARCH_PATH: security definer function public.%', r.proname;
  end loop;

  for r in
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    raise exception 'ANON_CAN_EXECUTE_DEFINER: public.%', r.proname;
  end loop;

  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and has_table_privilege('anon', c.oid, 'select, update, delete, truncate')
  loop
    raise exception 'ANON_CAN_TOUCH_TABLE: public.%', r.relname;
  end loop;

  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and has_table_privilege('anon', c.oid, 'insert')
      and c.relname <> 'analytics_events'
  loop
    raise exception 'ANON_CAN_INSERT_TABLE: public.%', r.relname;
  end loop;
end $$;

select 'RLS_HARDENING_OK' as result;

rollback;
