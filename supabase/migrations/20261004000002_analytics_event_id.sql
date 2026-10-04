-- Migration: 20261004000002_analytics_event_id.sql
-- Client-generated idempotency key so retried analytics batches can be deduplicated

alter table analytics_events
  add column if not exists event_id uuid;

-- Nullable: rows inserted before this migration have no event_id.
-- Unique: retries of an already-delivered batch fail with 23505 instead of duplicating.
create unique index if not exists idx_analytics_events_event_id
  on analytics_events (event_id);
