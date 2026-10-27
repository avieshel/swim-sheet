-- Removing the drill `timing_mode` distinction (individual vs continuous).
--
-- The feature was client-only: the column was written by the PWA sync transport
-- but never read by the Express server, and the AI draft harness never produced
-- it (apply.ts hardcoded 'individual'). The only behavioral branch lived in the
-- PWA's runService, which now always unrolls every rep/item. Keeping a dead,
-- nullable column around only confuses the schema, so drop it from both tables.
--
-- Safe to drop: column is nullable, written only by the client, and no server
-- query references it. Existing 'continuous' rows are ignored after this change.

alter table drills drop column if exists timing_mode;
alter table library_drills drop column if exists timing_mode;
