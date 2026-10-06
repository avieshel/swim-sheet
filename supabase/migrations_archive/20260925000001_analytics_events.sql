-- Migration: 20260925000001_analytics_events.sql
-- Creates the analytics_events table and RLS policies for telemetry sinks

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  device_id text not null,
  event_name text not null,
  properties jsonb not null default '{}',
  app_version text,
  platform text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table analytics_events enable row level security;

-- Policy: Anyone (even anonymous or authenticated users) can insert telemetry events
create policy "Allow insert telemetry for all"
  on analytics_events for insert
  with check (true);

-- Policy: Only service_role can read analytics (protects coach telemetry privacy)
create policy "Restrict analytics read to service role"
  on analytics_events for select
  using (false);
