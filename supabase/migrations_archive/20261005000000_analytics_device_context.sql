-- Migration: 20261005000000_analytics_device_context.sql
-- Adds device context columns (geo, language, hardware, network) for usage analytics.
-- All nullable: events from older cached PWAs arrive without them.

alter table analytics_events
  add column if not exists device_country text,
  add column if not exists device_language text,
  add column if not exists device_os text,
  add column if not exists device_type text,
  add column if not exists device_screen text,
  add column if not exists device_connection text;
