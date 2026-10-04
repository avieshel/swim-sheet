-- Migration: 20261004000003_analytics_build_sha.sql
-- Exact build (git commit) behind each event, alongside the semantic app_version

alter table analytics_events
  add column if not exists build_sha text;
