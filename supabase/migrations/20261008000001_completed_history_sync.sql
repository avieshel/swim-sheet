create table if not exists public.lane_drill_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.session_runs(id) on delete cascade,
  group_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  lane integer not null,
  run_drill_id uuid not null references public.run_drills(id) on delete cascade,
  completed boolean not null default false,
  data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_lane_drill_results_organization_id on public.lane_drill_results(organization_id);
create index if not exists idx_lane_drill_results_run_id on public.lane_drill_results(run_id);
create index if not exists idx_lane_drill_results_run_drill_id on public.lane_drill_results(run_drill_id);
create index if not exists idx_lane_drill_results_updated_at on public.lane_drill_results(updated_at);

drop trigger if exists lane_drill_results_set_updated_at on public.lane_drill_results;
create trigger lane_drill_results_set_updated_at
  before update on public.lane_drill_results
  for each row execute function public.set_updated_at();

alter table public.lane_drill_results enable row level security;

revoke all on table public.lane_drill_results from public, anon, authenticated;
grant select, insert, update, delete on table public.lane_drill_results to authenticated, service_role;

drop policy if exists lane_drill_results_select on public.lane_drill_results;
create policy lane_drill_results_select on public.lane_drill_results
  for select to authenticated
  using (organization_id is not null and public.is_organization_member(organization_id));

drop policy if exists lane_drill_results_insert on public.lane_drill_results;
create policy lane_drill_results_insert on public.lane_drill_results
  for insert to authenticated
  with check (
    organization_id is not null
    and public.is_organization_member(organization_id)
    and public.user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists lane_drill_results_update on public.lane_drill_results;
create policy lane_drill_results_update on public.lane_drill_results
  for update to authenticated
  using (organization_id is not null and public.is_organization_member(organization_id))
  with check (
    organization_id is not null
    and public.is_organization_member(organization_id)
    and public.user_has_permission(auth.uid(), organization_id, 'sync:use')
  );

drop policy if exists lane_drill_results_delete on public.lane_drill_results;
create policy lane_drill_results_delete on public.lane_drill_results
  for delete to authenticated
  using (
    organization_id is not null
    and public.is_organization_member(organization_id)
    and public.user_has_permission(auth.uid(), organization_id, 'organization:manage')
  );
