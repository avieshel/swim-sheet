# AI Eval & Ops Context

Operational notes for inspecting AI session generation quality and the known
follow-ups around cross-device sync. Historical task entries live in
`docs/archive/App-Tasks-Context.md`; this file keeps only what an agent needs to
operate and debug these features.

## AI session generation — "closing the loop"

**Trace table**: `ai_private.ai_analytics_trace` (Supabase). Each generation
attempt is logged with the model that actually answered, the validator failure
string, and the raw SSE body on empty streams. Inspect via the read-only
`ss_inspector` role, which was granted `USAGE` + `SELECT` on `ai_private` (verified
2026-10-26 by running read-only queries against production through that role).

**Eval pipeline**: `supabase/evals/` — corpus in `supabase/evals/cases.ts`,
scorers in the eval runner. Scorer kinds include `distinctDrillNames`,
`descriptionMentions`, `distinctIntensities`, `anyOf`. Run via
`deno task test` in `supabase/functions/ai-session-harness/` (unit fakes) and the
eval runner against a live model.

**Shared contract**: `shared/sessionDraft/` (types, config, validate, format,
schema). The harness (`supabase/functions/ai-session-harness/`) splits LLM-facing
code (`agent/`) from transport/auth/rate-limit (`harness/`). Keep them separate
and testable with fakes.

**Standing caveat**: the `ai-session-harness` Edge Function deploys manually (CI only
deploys the PWA). Production may run a stale build — redeploy before judging
improvements on production traces. `PROVIDER_STRUCTURED_OUTPUTS` stays unset until
the endpoint supports `json_schema`.

**Recommendation carried forward**: prefer a non-reasoning model (e.g.
`openai/gpt-4.1-mini`) — reasoning-token bleed caused most failed attempts in the
2026-10-26 incident and consumed the token budget entirely in one case.

## Known follow-ups (sync)

- **Idle-device polling gap**: `POLL_INTERVAL_MS = 60000` in
  `client/src/sync/syncService.ts` is gated on `!document.hidden`, so a backgrounded
  tab never syncs. A `visibilitychange` → `syncNow` trigger (matching the existing
  `online` listener) would close it.
- **Swimmer name collisions**: no unique index on `swimmers.name` in Postgres, but
  Dexie has `&name`, so a pull can throw `ConstraintError`. `applyRemoteChanges`
  commits per table so one rejected row no longer rolls back everything; the
  duplicate stays pending and needs manual cleanup (or a future "Skip" action).
  Case-insensitive names ("Dan"/"dan") pass all layers silently.
- **Hosted sync unverified**: cross-device sync is verified against local Supabase
  only; hosted has one Google-authenticated user and no password-grant test user, so
  `tests/sync-cross-device.spec.ts` cannot run there yet.
- **`sync-cross-device.spec.ts` is not idempotent**: reuses a fixed session id and
  mutates names; run `supabase db reset --local` between attempts. Also, run E2E via
  `npm run test:e2e` (sets `NODE_PATH`), not `npx playwright test` from root.
- **Tombstone purge parked**: `supabase/migrations_archive/20261011000000_purge_expired_tombstones.sql`
  is complete and verified locally but deliberately not in migration history (version
  collision with the snapshot migration). Re-add under a unique timestamp when ready.
- **Completed-history two-device E2E coverage** is deferred (issue #12). Do not
  repair or change E2E config as part of completed-history sync work.

## Analytics payload policy

Counts, enums, and action types only — no swimmer names, lap times, or free-text
notes. See `docs/context/UI-Context.md` for the event catalog.