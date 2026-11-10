# DB Sync Context

Supabase sync, RLS, tenant/identity model, and migration details. Schema and entity
tables live in `DB-Schema-Context.md`. Companion to `App-Context.md` (architecture)
and `AI-Eval-And-Ops-Context.md` (sync follow-ups).

## Tenant / Identity Model

One tenant abstraction supports all three confirmed coaching patterns:
- **Solo coach, multiple groups** (masters vs private lessons): `swimmers.group`
  (primary bucket) + optional `swimmers.labels[]` (multi-tags). Not a separate swim
  school.
- **Shared organization / head coach distributing work**: `organizations` +
  `organization_memberships` + roles. Head coach = `owner` (full + distribute).
  Coaches = `coach`.
- **Share or withhold a session**: `sessions.visibility`: `private` (default;
  creator + owner only) | `organization` (all members can view/use). Distribute
  weekly sessions via `sessions.assigned_to` (profile id; implies visibility).
- **Track weekly load / student totals**: `session_runs.organization_id` (+ per-swimmer
  links) for completed runs that sync; aggregates are organization-scoped.

**Local-first:** PWA keeps working with no account. A default local organization is
created for tagging; login **claims** local organizations into Supabase (same UUID).
Sync/collab only for claimed organizations.

### Owner Coach-Assist (admin write path)

The `admin-coach-assist` Edge Function lets the **app owner** create/edit/delete
sessions, drills, swimmers, and library drills inside a specific coach's personal
organization, so the owner can assist a coach without touching other coaches' data
or their own account. The assisted rows are then delivered to the coach's device via
the normal sync path.

**Access control (strict, owner-only):**
- Deployed with JWT verification ON. The caller's identity is resolved from the
  request JWT (`getCallerUid`); a missing/unverifiable token is treated as
  "not an owner".
- The caller must be in the `OWNER_USER_IDS` allowlist (`isOwner`) or the request is
  rejected with `403` on every route (the gate lives in exactly one place,
  `withOwner`).
- The `service_role` key is used only inside the function (owner write path); it is
  never exposed to clients, and the function is **never** invoked with
  `--no-verify-jwt`.

**Scoping invariants (why it cannot corrupt other coaches):**
- Writes never trust a client-supplied organization. The target coach's personal
  org is resolved **server-side** via `resolveCoachOrg(coachUserId)` (SELECT
  `organizations` WHERE `created_by = <coach>`); a mutation fails closed if the coach
  owns none or more than one.
- `normalizeScopedWrite` always stamps `organization_id = <resolved org>` and
  `created_by = <coachUserId>`. Any `organization_id`/`created_by` present in the
  caller payload are **ignored** (reserved keys), so a caller can never smuggle a
  foreign org or a different owner.
- `deleteRow` additionally scopes the delete by both `id` and `organization_id`.

**Delivery + isolation:** because `created_by` and `organization_id` are stamped to
the *coach*, the row is indistinguishable from one the coach created themselves. The
coach's normal PWA `pull` (`SupabaseSyncTransport.pull` → `select * from <table>
where organization_id = <coach org>`, authenticated as the coach) returns it; another
coach's pull cannot see it because RLS `is_organization_member(organization_id)` is
false across tenants. End-to-end proof:
`supabase/functions/admin-coach-assist/integration/isolation_check.ts` writes a
session to Coach A via the real service, then asserts Coach A's pull includes it
while Coach B's pull (RLS) excludes it.

**Session bundle writes:** Coach Assist AI saves and `.swimsheet` imports call the
owner-gated Edge Function, which resolves the target organization server-side and
invokes `public.admin_create_session_bundle`. The Postgres function accepts only
allowlisted session/drill fields, stamps the target organization and coach identity,
and inserts the session plus all drills in one transaction. Its execute grant is
revoked from `PUBLIC`, `anon`, and `authenticated`; only `service_role` may call it,
and that key stays in the Edge Function. Package imports are validated again in the
Edge Function using the shared `sessionPackage` contract. Name-conflict imports are
serialized by target organization and normalized session name, returning a conflict
without inserting rows. The coach receives the records through the normal sync pull;
the owner's Dexie and other coach tenants are not write targets.

## Sync Dependency Order

Pending cloud writes are ordered with parent rows before dependents. `sessions`
precede template `drills`; completed `session_runs` precede `run_drills`/`run_swimmers`,
which precede `laps`/`lane_drill_results`. Pending metadata key order is not a valid
dependency order.

## Completed-History Sync

Swimmers, reusable session content, and completed run history sync through the
authenticated Supabase personal organization. A run and its history graph stay local
while `SessionRun.status` is `active`; completion makes the run, drill snapshots,
swimmer links, laps, and timing snapshots eligible. The original UUIDs are retained
and upserted so retries update the same records. `LaneDrillResult` remains the local
JSON snapshot model, mirrored by `public.lane_drill_results`; in-memory live timer
state is never synced. Existing local completed history is reconciled by ID on first
rollout. Run history deletion uses tombstones, and deleting a session template does
not physically delete its separate completed run snapshot.

## RLS

Domain rows always scoped by `organization_id` + membership. Session SELECT allows
`visibility = 'organization'` OR creator OR `assigned_to` OR `organization:manage`.
Deletes remain owner-only.

## Pull Cost (`sync_pulse` probe)

`SupabaseSyncTransport.pull` used to issue one PostgREST select per sync table (9) on
every sync, and an idle device syncs on a 60s poll plus once after each local edit.
Since there is normally nothing to fetch, that was ~540 empty requests/hour/device.
The push side was already free when idle (empty pending array → no request).

`public.sync_pulse(organization, cursors)` now answers "which tables could have rows
past these cursors?" in one request, and `pull` queries only those. Measured against
local Supabase via the Kong access log: **27 → 3 requests for three idle syncs**
(9 → 1 each). Cost when something *has* changed is one extra request.

The probe may only ever **skip** work, never decide it, because its failure mode is
silent and unrecoverable: a false "clean" strands a cursor behind a newer row and
that table stops syncing forever, with no error anywhere. So it errs outward in three
ways — it ignores the per-table visibility and completed-run filters the real pull
applies (over-reports), treats a missing cursor as `-infinity` (so a client that
stopped sending cursors degrades to the full fan-out rather than never syncing), and
`pull` falls back to asking for every table whenever the RPC errors or returns an
unexpected shape (safe to deploy the client before the migration lands). The
timestamp comparison happens in Postgres rather than as a client-side string compare,
because a rendering difference between the RPC and table-read paths would otherwise
fail in exactly that silent direction. Verified end-to-end through PostgREST:
caught-up → `[]`, behind → only the affected table, non-member → `[]`, signed-out →
`42501`.

## Supabase Security Baseline

Hosted project `pcdmtsafwmlqdwjxbajc`,
`supabase/migrations/20261005001000_initial_schema.sql`:
- Every `public` table has RLS enabled and at least one policy (17 tables, 48
  policies). Asserted by `supabase/tests/rls_hardening_check.sql` (local) and
  `supabase/tests/verify-hosted.sh` (hosted, over the management API).
- Table grants written explicitly: `anon` may only insert into `analytics_events`;
  `authenticated` and `service_role` get full CRUD. Supabase's default privileges
  differ between local and hosted, so the baseline never inherits them.
- All `SECURITY DEFINER` functions pin `set search_path = public`, and `EXECUTE` is
  revoked from `PUBLIC`/`anon`. The GDPR/maintenance helpers are `service_role` only.
- The baseline migration is the single source of truth and fully idempotent
  (`drop policy if exists` guards on all 48 policies), so a partially applied schema
  is always healed by re-running the file.
- Hosted DB rebuilt from this baseline on 2026-10-07: `public` dropped and replayed,
  `auth` users/OAuth config/API keys/project ref untouched.
- `20261007000000_sync_foundation.sql` applied to hosted 2026-10-08 via
  `supabase db push --linked` (additive, idempotent). Hosted is at 2 recorded
  migrations.
- `20261008000001_completed_history_sync.sql` adds the RLS-protected
  `lane_drill_results` cloud table; applied to both local and hosted 2026-10-08.
  Hosted is at 18 tables / 52 policies / 4 recorded migrations.
- `20261009000000_run_template_name_snapshot.sql` adds `session_runs.session_name`
  and backfills. Applied to both on 2026-10-09 (5 recorded migrations).
- `20261011000000_snapshot_columns.sql` adds the frozen-history columns
  (`session_runs.session_snapshot`, `run_drills.drill_index`, `drills.library_drill_id`,
  plus `idx_drills_library_drill_id`). Applied to both on 2026-10-11 (6 recorded
  migrations). All three columns nullable, so the columns-first rollout is safe.
- `20261011000000_purge_expired_tombstones.sql` is **archived, not applied** —
  version collision with the snapshot migration. See
  `docs/context/AI-Eval-And-Ops-Context.md` for pickup steps.
- `20261014000000_ai_session_harness_rate_limit.sql` adds the private `ai_private`
  operational store for AI harness rate limiting (not exposed by PostgREST). Local
  verification via `supabase/tests/ai_rate_limit_check.sql`.
- `20261014000001_sync_pulse.sql` adds the read-only `public.sync_pulse` RPC. Not yet
  applied to hosted — until it is, the RPC errors and the client falls back to the
  old full fan-out, so it is safe to deploy ahead of the migration.
- `20261019000000_ai_session_harness_trace.sql` / `20261019000100_..._signature_fix.sql`
  add the `ai_private.ai_analytics_trace` table + `ai_analytics_trace_insert` RPC for
  AI generation telemetry.
- `20261110000000_admin_session_bundle.sql` adds the service-role-only transactional
  session-bundle RPC. It is present in the migration directory but has not been
  applied to the hosted project. The local function was applied directly for
  integration verification; the local migration history still has an unmatched
  `20261020000000` entry, so `supabase migration up` cannot run until that divergence
  is resolved. Do not deploy code that calls the RPC until the migration is applied
  to the intended hosted project.

## Migration Ordering Rule

Apply schema **before** merging the code that needs it, because `main` merges trigger
the Cloudflare Pages deploy. Nothing in CI runs migrations, so an unapplied migration
is otherwise only discovered at runtime.

- **Migration filenames must be globally unique.** Supabase derives the migration
  version from the filename prefix. A duplicate prefix is not rejected — `db push`
  applies one file and records that version, and the other is skipped permanently.
  Check with `ls supabase/migrations/ | sed 's/_.*//' | sort | uniq -d`.
- **Never edit an applied migration to make hosted match.** `20261005001000` is
  already in hosted's `schema_migrations`, so `db push` skips it. This divergence is
  permanent and deliberate.

## Session → SessionRun (Template/Instance) Pattern

- `Session` is a reusable template with drills
- `SessionRun` snapshots drills into `RunDrill` records when a session starts
- Historical runs are never corrupted by template edits
- `RunSwimmer` links swimmers to a run (replaces the old `SessionSwimmer` join table)

**Snapshot rule (no joins on big tables).** A run must render from its own columns,
never by joining back to `sessions`. `SessionRun.sessionName` is frozen at run start
and **never refreshed** — renaming a template does not rewrite history. This is why
deleting a template no longer collapses historical runs to "Deleted template".
`RunDrill` (name/stroke/distance) and `LaneDrillResult.data` (swimmer `dbId` + `name`)
follow the same rule.

Generalised as a project guideline: **joins are permitted only onto small, bounded
tables** (equipment options, settings, permission catalogs). Any join in the read path
onto a table that grows with usage — `sessions`, `session_runs`, `run_drills`, `laps`,
`swimmers`, `lane_drill_results` — is a code smell and should be flagged in review.
Denormalise into a frozen snapshot at write time instead. The only remaining join in
the run read path is the legacy fallback in `buildRunSummary` for runs recorded before
`sessionName` existed; it is skipped whenever the snapshot is present.

Migration `20261009000000_run_template_name_snapshot.sql` adds
`session_runs.session_name` and backfills existing rows from the template where it
still exists. Runs whose template is already deleted stay `NULL` and keep the legacy
fallback.

## Timed Groups persist in LaneDrillResult

Timing data is stored as a JSON blob in the `LaneDrillResult` table, keyed by
`groupId` (UUID) — supports multiple groups per physical lane. All timestamps are
session-relative (sessionElapsed = Date.now() - sessionStartedAt - sessionPauseDuration).
Timing data is stored as a flat key-value map in an in-memory `TimestampStore` (backed by
`Map<string, number>`) for live editing; keys use a hierarchical scheme enabling
prefix-delete for clear operations. `LaneDrillResult` persists a **snapshot** (JSON blob
of `drillStart`/`drillEnd`/`sessionStartedAt`/`swimmers[]`) only at save/complete time.
`lane_drill_results` mirrors completed-run snapshots to Supabase; active-run snapshots
and in-memory timing state remain device-local.

## Frozen History Snapshot

A completed run is a **self-contained record**. At run start (`runService.createFromTemplate`)
one `SessionSnapshot` JSON blob is frozen onto the `SessionRun`, holding every authored
session/drill field verbatim plus derived per-drill metrics. `RunDrill.drillIndex` is a
stable integer into that frozen array and replaces `parentDrillId`.

**Why:** before this, `RunDrill` was a *lossy rendering* of the drill, not a copy —
`items` were flattened to an `instructions` text string, only `items[0].stroke`
survived, and `focus`/`labels`/`timingMode`/`segments` were dropped entirely. Editing a
drill's sets silently rewrote history. Because history no longer reads `sessions` or
`drills`, editing or deleting either can never alter what was recorded.

**Rules:**
- `poolLength` is **not** in the snapshot: `SessionRun.poolLength` is already frozen at
  run start from app settings and already rendered.
- `visibility` is **not** captured (access control, not a fact about what happened).
  Nor is `libraryDrillId` (authoring provenance).
- `RunDrill.stroke` is `metrics.dominantStroke`, not `items[0].stroke` — the old form
  mislabelled every mixed-stroke drill. Legacy rows keep their stored value.
- **No backfill.** `version(8)` has no `upgrade()`. Existing runs keep `drillIndex`
  null/undefined and no snapshot; the authored detail is genuinely gone and is not
  reconstructed.
- Dexie leaves `drillIndex` **undefined** (not null) on migrated rows, so readers must
  test `!= null`. `groupDrillRows` groups by `drillIndex` and falls back to
  `parentDrillId` when both rows lack one.

`resolveRunDrills(run, storedRows)` in `runHistoryService.ts` supplies drill display
fields from the snapshot and falls back to stored rows for: a pre-snapshot run,
malformed JSON, a snapshot that parses to a non-object, an empty `drills` array, or an
out-of-range index. **It never throws** — a coach looking at history cannot be handed
an exception.

**Reference-counting asymmetry** (deliberate, not inconsistent):
- Editing a session/drill: always safe, no warning.
- Deleting a drill from a session: always safe.
- Deleting a **session**: refused while any run from it is `status === 'active'` (UX
  rule, not data safety). The API is `deleteSession(id, { force? })` — the refusal
  returns `{ ok: false, reason: 'active_run' }`; `SessionsList` then offers the confirm
  "Delete live session and template?" → **Delete both**, which ends and cascade-deletes
  the active run before removing the template. Completed runs never block — they only
  drive a confirm stating the count and that history is preserved. A deleted starter
  template (`catalogKey` set) is recorded via `markSeedSessionDismissed` so seeding
  does not re-create it.
- Deleting a **library drill** in use: warns, names each referencing session and its
  drill count, then offers "Delete everywhere" or cancel.

**Library provenance:** `Drill.libraryDrillId` records which `libraryDrills` entry a
session drill was copied from. This is copy-on-use *with provenance* — a session still
owns its own drill rows and edits never propagate. The cloud column is a **soft
reference with no FK constraint**: a hard cascade would let one library deletion
destroy drills inside sessions a coach still works from. A dangling reference is
expected, not corruption — nothing resolves it on a read path, and repair (repoint/clear)
is offered but never automatic.

Design: `docs/superpowers/specs/2026-10-11-frozen-history-snapshot-design.md`.

## Related
- Schema + entity tables: `docs/context/DB-Schema-Context.md`
- Drill domain model: `docs/context/Drill-Model-Context.md`
- Session domain model: `docs/context/Session-Model-Context.md`
