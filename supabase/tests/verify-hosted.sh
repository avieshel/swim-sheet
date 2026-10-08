#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SWIMSHEET_SCRIPT_DIR="$SCRIPT_DIR"
exec python3 - "$@" <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request

SQL = """
select
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as rls_disabled,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (select 1 from pg_policies p
                      where p.schemaname = 'public' and p.tablename = c.relname)) as tables_without_policy,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r') as tables,
  (select count(*) from pg_policies where schemaname = 'public') as policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')) as anon_exec_definer,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%')) as unpinned_definer,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not has_table_privilege('authenticated', c.oid, 'select')) as auth_missing_select,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'select,update,delete,truncate')
           or (has_table_privilege('anon', c.oid, 'insert') and c.relname <> 'analytics_events'))) as anon_scope_violations,
  (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where c.relnamespace = 'auth'::regnamespace and t.tgname = 'on_auth_user_created') as signup_trigger,
  (select array_to_string(p.proconfig, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'anonymize_swimmer') as anonymize_search_path,
  (select count(*) from supabase_migrations.schema_migrations) as recorded_migrations
"""


def resolve_project_ref():
    if os.environ.get('SUPABASE_PROJECT_REF'):
        return os.environ['SUPABASE_PROJECT_REF']
    start = os.path.abspath(os.environ.get('SWIMSHEET_SCRIPT_DIR', os.getcwd()))
    directory = start
    while True:
        candidate = os.path.join(directory, 'supabase', '.temp', 'project-ref')
        if os.path.exists(candidate):
            return open(candidate).read().strip()
        parent = os.path.dirname(directory)
        if parent == directory:
            break
        directory = parent
    sys.exit('No project ref: set SUPABASE_PROJECT_REF or run supabase link')


def resolve_token():
    if os.environ.get('SUPABASE_ACCESS_TOKEN'):
        return os.environ['SUPABASE_ACCESS_TOKEN']
    path = os.path.expanduser('~/.supabase/access-token')
    if os.path.exists(path):
        return open(path).read().strip()
    sys.exit('No API token: set SUPABASE_ACCESS_TOKEN or log in with the Supabase CLI')


def run_query(ref, token):
    request = urllib.request.Request(
        'https://api.supabase.com/v1/projects/{0}/database/query'.format(ref),
        data=json.dumps({'query': SQL}).encode('utf-8'),
        headers={
            'Authorization': 'Bearer {0}'.format(token),
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        payload = json.load(urllib.request.urlopen(request, timeout=60))
    except urllib.error.HTTPError as error:
        sys.exit('Query failed: {0}'.format(error.read().decode('utf-8')[:500]))
    if isinstance(payload, dict):
        sys.exit('Query failed: {0}'.format(payload.get('message', payload)))
    if not payload:
        sys.exit('Query returned no rows')
    return payload[0]


def main():
    ref = resolve_project_ref()
    token = resolve_token()
    row = run_query(ref, token)

    if '--json' in sys.argv[1:]:
        print(json.dumps(row, indent=2, sort_keys=True))
        return 0

    checks = [
        ('RLS enabled on every public table', row['rls_disabled'] == 0),
        ('every table carries at least one policy', row['tables_without_policy'] == 0),
        ('no anon-executable SECURITY DEFINER function', row['anon_exec_definer'] == 0),
        ('every SECURITY DEFINER function pins search_path', row['unpinned_definer'] == 0),
        ('authenticated can SELECT every public table', row['auth_missing_select'] == 0),
        ('anon confined to analytics_events INSERT', row['anon_scope_violations'] == 0),
        ('signup trigger on auth.users present', row['signup_trigger'] >= 1),
    ]

    print('SwimSheet hosted security audit — project {0}'.format(ref))
    print('tables={0} policies={1} recorded_migrations={2} anonymize_search_path={3}'.format(
        row['tables'], row['policies'], row['recorded_migrations'], row['anonymize_search_path']))
    print('')

    failed = []
    for label, ok in checks:
        print('  {0}  {1}'.format('PASS' if ok else 'FAIL', label))
        if not ok:
            failed.append(label)

    print('')
    if failed:
        print('{0} check(s) failed — hosted schema has drifted from supabase/migrations/'.format(len(failed)))
        return 1
    print('All checks passed.')
    return 0


sys.exit(main())
PY
