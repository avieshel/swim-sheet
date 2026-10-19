-- Corrective migration: the applied ai_analytics_trace table is missing the
-- attempt_count column. The original 20261019000000 migration drifted — the
-- table was created without attempt_count while the insert function (recreated
-- with the full 18-argument signature in 20261019000100) references it, so every
-- trace insert failed with "column attempt_count does not exist".
--
-- Add the column idempotently. The NOT NULL DEFAULT 1 backfills existing rows
-- and matches the intended schema (attempt_count integer not null default 1).

alter table ai_private.ai_analytics_trace
  add column if not exists attempt_count integer not null default 1;
