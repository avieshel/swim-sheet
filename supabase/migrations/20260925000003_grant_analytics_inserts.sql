-- Migration: 20260925000003_grant_analytics_inserts.sql
-- Grants table-level INSERT permissions to anon and authenticated roles for analytics_events

grant insert on analytics_events to anon, authenticated;
