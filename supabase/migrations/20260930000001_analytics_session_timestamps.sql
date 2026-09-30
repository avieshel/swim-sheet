-- Migration: 20260930000001_analytics_session_timestamps.sql
-- Adds session_id and epoch ms timestamps for client-side session tracking and time-of-day analysis

alter table analytics_events
  add column if not exists session_id uuid,
  add column if not exists timestamp bigint,
  add column if not exists device_created_tstamp bigint,
  add column if not exists device_sent_tstamp bigint,
  add column if not exists device_local_tstamp bigint,
  add column if not exists timezone text;

-- Index for querying by device + session
create index if not exists idx_analytics_events_device_session
  on analytics_events (device_id, session_id);

-- Index for time-range queries using client timestamp
create index if not exists idx_analytics_events_timestamp
  on analytics_events (timestamp);