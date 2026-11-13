# Unit Test Review & Refinement Plan

> **Iteration 1 (this document):** a record for every unit-test suite — the source it
> covers, what the tests *should* actually lock in, the cheapest way to get a clear
> pass/fail signal, and overlap/duplication notes.
>
> **Iteration 2 (later tasks):** for each record below, open the source + test, confirm
> the contract is covered, delete/fold redundant cases, and tighten weak (low-signal)
> assertions. The end state is a clean, concise, well-covered client + edge-function
> test base.
>
> Scope: Vitest unit suites (`client/src`, co-located `__tests__/` and standalone
> `*.test.ts`) and Deno Edge-Function suites (`supabase/functions/*_test.ts`,
> `supabase/evals/*_test.ts`). E2E Playwright specs are referenced only for
> cross-tier overlap.

---

## How to read the records

Each record answers five questions:

- **Responsibility** — what the module owns (the contract).
- **Must cover** — the behaviors any adequate suite *must* lock in. This is the target
  spec, independent of today's test code.
- **Current state** — what today's tests actually assert, at a glance.
- **Signal** — the cheapest level/technique that gives a *clear* pass/fail signal
  (so a green test means the behavior is genuinely correct).
- **Overlap / action** — duplication with other suites and the recommended fix.

---

## The "clear signal" strategy (applies to every record)

The user's worry — *too many tests, some overlapping* — is mostly **low-signal
delegation tests** and **the same logic asserted in 2–3 suites**. A test gives a clear
signal only when it asserts an *observable outcome*, not a collaborator call.

| Tier | Assert on | Avoid |
|------|-----------|-------|
| Pure function (utils, distance, validate, sanitize, format, prompt builders, scorer) | input→output table cases, invariants, boundary values | snapshot of the whole object |
| Store / reducer / context (syncStore, LiveSessionContext, liveTiming, timestampStore) | resulting state object & selectors after actions | spying on internal methods |
| Service (drill/run/session/swimmer/…) | real in-memory Dexie (fake-indexeddb) contents + returned values | "calls dao.x()" mocks |
| API layer (client/src/api) | network/error classification, anonymous-guard, real projection output | "delegates to service.x()" stubs |
| Component (RTL) | role/text/user-visible state via `user-event` | DOM structure/CSS, mock children |
| Edge Function (Deno) | response shape + side-effects through injected deps (fake fetch/clock/transport) | real network or real Supabase |

**Rule of thumb for trimming:** if a test would still pass after you delete the real
implementation and replace it with `service.x()` that does nothing but is still
"called", it is low-signal and belongs at most once (as a wiring contract), not at two
layers.

---

## Cross-cutting overlap findings (do these first — biggest payoff)

These are the duplication clusters that answer "I have too many overlapping tests".

1. **`buildLaneResult` projection is asserted in 3 suites.** ✅ **RESOLVED (iteration 2).**
   `client/src/api/__tests__/runs.test.ts` (buildLaneResult cases),
   `client/src/api/__tests__/saveFlow.test.ts` (huge — buildLaneResult + end-to-end
   LiveTimingStore + collectSessionLaps), and the liveTiming/timestampStore suites
   jointly. **Action taken:** `buildLaneResult` now has a *single* owner —
   `saveFlow.test.ts`. The 2 unique `existingData` cases (status preservation from prior
   saved data: `skipped`/`notdone`/`timed`) were moved from `runs.test.ts` into
   `saveFlow.test.ts`'s projection describe; the 2 remaining `runs.test.ts` cases were
   pure duplicates of saveFlow cases and were deleted. `runs.test.ts` now covers only
   delegation + `pruneRemovedDrillData` + run-history; its `buildLaneResult`,
   `LiveDrillTiming`, and `SavedDrillData` imports were removed. No production code
   changed. Result: 81 tests green, coverage preserved (status derivation still
   asserted via the moved `existingData` cases). The liveTiming/timestampStore suites
   test the *stores* that feed `buildLaneResult`, not the projection itself, so they are
   intentionally kept (different contract).

2. **Two layers of "calls dao.x()" wiring tests.**
   API delegation suites (`drills`, `swimmers`, `sessions`, `runs`, `sessionPackages`,
   `sessionDraft` apply) and service delegation suites (`drillService`, `swimmerService`,
   `settingsService`, `sessionService`) both assert pass-through. **Action:** keep the
   service layer as the single wiring contract; reduce API delegation to a *representative
   parametric* check and reserve API-suite space for genuinely API-layer concerns
   (HTTP/error mapping, anonymous guards, projection, prune).

3. **`validateSessionDraft` is tested 2× on the client + 1× in evals.**
   `shared/sessionDraft/validate.ts` (source of truth, tested under
   `services/sessionDraft/__tests__/validate.test.ts`) plus the Deno eval
   `scorer_test.ts` and the PWA `services/sessionDraft/__tests__/validate.test.ts`.
   **Action:** shared module is the contract; PWA wrapper test covers only *config
   binding*; evals should import/use the shared validator rather than re-implement.

4. **Distance / drill-metrics math is duplicated.**
   `sessionDraft/distance.ts`, `utils/sessionSnapshot.ts` (computeDrillMetrics),
   `services/runHistoryService.ts` (snapshots), and `evals/scorer.ts`
   (totalDistance/repeatCountForDistance). **Action:** `shared/sessionDraft/distance.ts`
   is the single source of truth; other suites assert *their* mapping, not re-derive the
   math.

5. **Swimmer editing flows spread across 4 component suites.**
   `SwimmerRows` (active + saved describe blocks), `swimmerRowGesture`,
   `SwimmerFormModal`, `SwimmerBreakoutCard` all exercise promote-temp-to-roster /
   re-link / edit. **Action:** draw hard boundaries — FormModal = pure modal; Rows =
   row + gesture + autocomplete; BreakoutCard = breakout view; gesture = right/middle
   click inertness. Merge the two SwimmerRows describe blocks into one parametrized
   "promote from any row" set.

6. **Sync cluster (8 suites) has policy overlap.**
   `accountIsolation` overlaps `syncStore` claimable tests; `conflictResolution`
   overlaps `syncStore.applyRemote`; `failureContainment` overlaps `syncRecovery`.
   **Action:** keep `syncStore` = state, `syncService` = orchestration,
   `SupabaseSyncTransport` = wire format, and the four policy suites each own a distinct
   scenario class — audit and dedupe shared scenarios.

7. **Auth/account UI tested in 4 suites.**
   `AccountSection` (sign-in + analytics), `Settings` (analytics), `AuthProvider`
   (provider state), `AuthCallback` (routing). Sign-in *tracking* is asserted in both
   AccountSection and Settings. **Action:** AuthProvider = provider state machine;
   AccountSection = auth UI + sign-in/out tracking; Settings = *settings* analytics only.

---

## C1 — API layer (`client/src/api`)

### api/__tests__/auth.test.ts
- **Source:** `client/src/api/auth.ts`
- **Responsibility:** auth status, Google/test sign-in, redirect URL, session restore/delegation.
- **Must cover:** test-login gating (production off, dev/on when enabled); redirect URL = `/auth/callback` on current origin; persist flag written before redirect; sign-out delegation; status enum exhaustiveness.
- **Current:** 11 cases, behavior-focused (good signal).
- **Signal:** assert redirect URL + persisted flag via injected auth; minimal Supabase mocking.
- **Overlap:** `AuthProvider.test.tsx` overlaps sign-in delegation; AccountSection overlaps UI. Keep `auth.ts` as logic owner.

### api/__tests__/authStorage.test.ts
- **Source:** `client/src/api/authStorage.ts`
- **Responsibility:** persist-flag storage (local vs session), active-store selection, stale-session cleanup.
- **Must cover:** default-persist when flag absent/unparseable; sessionStorage flag ignored; setPersistEnabled toggles only the right store; adapter read/write/remove on the active store.
- **Current:** 7 cases, solid.
- **Signal:** assert chosen store contents directly.

### api/__tests__/drills.test.ts
- **Source:** `client/src/api/drills.ts`
- **Responsibility:** thin API surface over `drillService`.
- **Must cover:** each method delegates to the right service method.
- **Current:** 12 delegation cases — **low signal** (see overlap #2).
- **Signal:** one parametric "delegates to service" table is enough.
- **Overlap:** duplicates `drillService.test.ts` wiring. **Action:** fold into a single parametric test; keep only if API adds its own logic later.

### api/__tests__/runs.test.ts
- **Source:** `client/src/api/runs.ts`
- **Responsibility:** API surface over `runService` + `runHistoryService` + the `buildLaneResult` projection.
- **Must cover:** delegation for CRUD/laps/results; `buildLaneResult` projection (the real logic here); `pruneRemovedDrillData` orphan cleanup; run-history read-model delegation.
- **Current:** 42 cases — 29 delegation + 6 `buildLaneResult` + prune/history.
- **Signal:** keep projection + prune as real assertions; delegation can be parametric.
- **Overlap:** `buildLaneResult` duplicates `saveFlow.test.ts` (overlap #1). **Action:** move projection cases to the canonical projection suite; keep delegation parametric + prune.

### api/__tests__/saveFlow.test.ts  ⚠️ largest file (796 lines)
- **Source:** `client/src/api/saveFlow.ts` (`buildLaneResult`, `collectSessionLaps`).
- **Responsibility:** project live timing → saved drill data; collect session laps at completion; temp-swimmer promotion.
- **Must cover:** cumulative→split conversion; drillStart/End fallbacks; per-swimmer independence; no input mutation / no lap-array aliasing; `collectSessionLaps` merge of persisted blobs + active store without double-count; temp-promotion flagging.
- **Current:** ~41 cases across buildLaneResult / e2e LiveTimingStore / lap-construction / collectSessionLaps.
- **Signal:** assert the *output* `SavedDrillData`; the "does not mutate input" + "no aliasing" cases are high-value.
- **Overlap:** #1 — projections also in `runs.test.ts`, `liveTiming.test.ts`, `timestampStore.test.ts`. **Action:** this file should *own* the projection contract; point the others at it and delete their copies.

### api/__tests__/sessionDraft.test.ts
- **Source:** `client/src/api/sessionDraft.ts` (`prepareSessionDraft`, `requestSessionDraft`, `requestSessionDraftStream`, `applySessionDraft`).
- **Responsibility:** build AI context; classify network/error outcomes; SSE streaming; anonymous guard.
- **Must cover:** empty/over-long prompt rejection *before* network; anonymous-user guard; 401→auth, 429→rate_limited (body + `Retry-After`), 5xx→provider, statusless→network, invalid→invalid; swimmer-name block; SSE delta→done framing; abort forwarding; apply delegation.
- **Current:** 27 cases, behavior-focused (good signal).
- **Signal:** stub `fetch`/transport, assert mapped error kind + retry seconds — high value.
- **Overlap:** `applySessionDraft` delegation overlaps service tests; keep delegation thin.

### api/__tests__/sessionPackages.test.ts
- **Source:** `client/src/api/sessionPackages.ts`
- **Responsibility:** API over `sessionPackageService`.
- **Must cover:** export/inspect/import delegation.
- **Current:** 3 delegation cases — low signal.
- **Signal:** parametric; real logic lives in `sessionPackageService.test.ts`.

### api/__tests__/sessions.test.ts
- **Source:** `client/src/api/sessions.ts`
- **Responsibility:** API over `sessionService` + `createSessionFromDraft`.
- **Must cover:** CRUD delegation; `createSessionFromDraft` routes to draft service and leaves session unmarked; invalid draft not marked.
- **Current:** 8 cases (5 delegation + 2 draft + 1 delegation).
- **Signal:** keep the draft-creation cases (real branch); delegation parametric.

### api/__tests__/sessionStatus.test.ts
- **Source:** `client/src/api/sessionStatus.ts` (`deriveSwimmerStatus`, `reconcileLaneStatuses`).
- **Responsibility:** session-completion coherence of per-swimmer status.
- **Must cover:** explicit stored status wins; `timed` > `done` > `done`-default; drop swimmers no longer in lane; cover every active swimmer once; preserve explicit `skip`/`notdone`; coach-un-done lane defaults missing to `notdone`.
- **Current:** 13 cases, thorough — good signal.
- **Signal:** pure-input→output table; high value, keep.
- **Overlap:** status semantics also in `TimingService` (`isLaneResultComplete`/`isLaneSettled`) and `swimmerStatusActions`. **Action:** this file owns *derived status*; TimingService owns *lane progression*; keep both but ensure they reference one definition of "done".

### api/__tests__/supabaseStorage.test.ts
- **Source:** `client/src/api/supabase.ts` (storage helpers).
- **Responsibility:** read current user id; ignore inactive-store session; auth-state subscription + unsubscribe.
- **Must cover:** clean store → null; inactive-store session never read; user-id from persisted session; unsubscribe on teardown.
- **Current:** 8 cases, solid.
- **Signal:** assert returned id / subscription behavior.

### api/__tests__/swimmers.test.ts
- **Source:** `client/src/api/swimmers.ts`
- **Responsibility:** API over `swimmerService`.
- **Must cover:** list/search/get/create/update/delete delegation.
- **Current:** 6 delegation cases — low signal.
- **Signal:** parametric; logic in `swimmerService.test.ts`.

---

## C2 — Services (core) (`client/src/services`)

### services/__tests__/analyticsService.test.ts  (482 lines, 19 cases)
- **Source:** `client/src/services/analyticsService.ts`
- **Responsibility:** event queue, batching, flush, dead-letter, retry/backoff, session identity.
- **Must cover:** enqueue+flush with metadata; anon vs user_id stamping; poison-event isolation + dead-letter; unique-violation = delivered; queue cap drops oldest; immutable session-start + sliding activity; pagehide keepalive; stats; stable per-device id fallback chain (localStorage→sessionStorage→mint).
- **Current:** 19 cases, very thorough — good signal.
- **Signal:** fake transport + clock; assert queued payloads & delivery order. Keep as-is.

### services/__tests__/deviceContext.test.ts  (102 lines)
- **Source:** `client/src/services/deviceContext.ts`
- **Responsibility:** CDN trace parse, country cache/TTL, device context assembly.
- **Must cover:** `parseCdnCgiTrace` missing/malformed → null; country fetch-once + TTL re-fetch + miss cache; full context merge.
- **Current:** 9 cases, solid.
- **Signal:** stub fetch; assert parsed country / context object.

### services/__tests__/drillService.test.ts
- **Source:** `client/src/services/drillService.ts`
- **Responsibility:** template + library drill CRUD over DAO.
- **Must cover:** each method delegates to the correct DAO call; error propagation.
- **Current:** 13 cases, mostly delegation.
- **Signal:** this is the legitimate single wiring layer (overlap #2) — keep, but make it parametric.
- **Overlap:** API `drills.test.ts` duplicates it; see #2.

### services/__tests__/libraryRefService.test.ts
- **Source:** `client/src/services/libraryRefService.ts`
- **Responsibility:** find sessions using a library drill; dangling refs; safe delete-with-refs; repoint/clear provenance.
- **Must cover:** in-use naming + count; dangling-only filter; delete removes entry + copies; repoint changes provenance only (never content); clear leaves usable personal drill; gone-ref drill never blocks.
- **Current:** 11 cases, behavior-focused — good.
- **Signal:** in-memory Dexie; assert resulting refs / deletions.

### services/__tests__/runHistoryService.test.ts  (456 lines, 23 cases)
- **Source:** `client/src/services/runHistoryService.ts`
- **Responsibility:** history read-model, snapshot resolution, export, delete.
- **Must cover:** empty history; frozen name survives template delete/rename; live-template fallback for no-snapshot runs; summary with real + virtual swimmers; filter by real RunSwimmer; virtual-only match by blob name (`matchedByName`); newest-first sort; `getRunById` null for unknown; `resolveRunDrills` prefers snapshot, falls back on malformed/null/legacy; export JSON shape; cascade delete.
- **Current:** 23 cases, thorough — good signal.
- **Signal:** assert resolved drills + summary counts from Dexie.
- **Overlap:** snapshot math overlaps `sessionSnapshot`/`distance` (overlap #4). Keep `resolveRunDrills` fallback cases; don't re-test distance math.

### services/__tests__/runService.test.ts  ⚠️ 745 lines, 52 cases
- **Source:** `client/src/services/runService.ts`
- **Responsibility:** run + drills + swimmers + lane results + laps lifecycle; `createFromTemplate` freeze.
- **Must cover:** CRUD delegation (legit wiring); lane-result marker semantics (start/complete/uncomplete/no-op); `createFromTemplate` — throw if no session, freeze template name + snapshot, unroll drills, skip empty items, one drillIndex per rep, per-item stroke preserved.
- **Current:** 52 cases — delegation + rich `createFromTemplate` semantics.
- **Signal:** delegation = parametric; `createFromTemplate` unrolling = high-value real assertions.
- **Overlap:** `buildLaneResult` not here, but `completeRunWithLaps` lives in `saveFlow` (overlap #1). Keep unroll cases; don't duplicate projection.

### services/__tests__/sessionPackageService.test.ts  (319 lines)
- **Source:** `client/src/services/sessionPackageService.ts`
- **Responsibility:** export mapping, inspection (name conflict + suggested name), import (fresh IDs, rollback, Coach Assist path).
- **Must cover:** export omits DB ids/ownership/local markers; derives missing summary fields; inspection rejects invalid + finds conflict + suggests numbered name; import creates owned copy, preserves empty/rich, no bank write, rollback on failure, conflict on concurrent, Coach Assist path.
- **Current:** 13 cases, behavior-focused — good.
- **Signal:** in-memory Dexie; assert written rows + returned status.
- **Overlap:** validation logic in `services/sessionPackage/__tests__/validate.test.ts` (keep separate — validation vs orchestration).

### services/__tests__/sessionService.test.ts
- **Source:** `client/src/services/sessionService.ts`
- **Responsibility:** session CRUD, usage ranking, delete guards (active-run blocking, dismissal).
- **Must cover:** list/listAll/listByUsage ranking; CRUD delegation; delete refuses when active run exists, ignores completed run, force-cascades, re-checks (don't trust caller), marks catalog session dismissed, not user session.
- **Current:** 19 cases, solid.
- **Signal:** assert returned blockers / dismissal marker; delegation parametric.

### services/__tests__/settingsService.test.ts
- **Source:** `client/src/services/settingsService.ts`
- **Responsibility:** settings CRUD over DAO; `DEFAULT_EQUIPMENT`.
- **Must cover:** each delegate; error propagation; `DEFAULT_EQUIPMENT` export.
- **Current:** 13 delegation cases — low signal.
- **Signal:** parametric; logic is DAO.

### services/__tests__/swimmerService.test.ts
- **Source:** `client/src/services/swimmerService.ts`
- **Responsibility:** swimmer CRUD over DAO.
- **Must cover:** each delegate; `deleteWithData`; `exportData`; error propagation.
- **Current:** 9 delegation cases — low signal.
- **Signal:** parametric.

### services/__tests__/swimmerStatusActions.test.ts  (169 lines)
- **Source:** `client/src/services/swimmerStatusActions.ts` (`skipSwimmer`, `markSwimmerDoneNoTime`).
- **Responsibility:** explicit per-swimmer status writes + live-store coherence.
- **Must cover:** create minimal lane result if none; write skipped; mark done-no-time; don't mark skipped as completed; update completion marker; drop live timing for skipped/done (scoped to swimmer+drill, leaving others).
- **Current:** 11 cases, behavior-focused — good.
- **Signal:** assert lane-result row + live-store state after action.
- **Overlap:** status semantics with `sessionStatus` + `TimingService` (overlap #7 in sync? no — see #1 area). Keep; ensure single definition of "done".

### services/__tests__/TimingService.test.ts  (116 lines)
- **Source:** `client/src/services/TimingService.ts` (`isLaneResultComplete`, `isLaneSettled`).
- **Responsibility:** lane progression derived from timed/live results.
- **Must cover:** complete only when every active swimmer accounted (skipped counts, notdone doesn't); settled across live+persisted; ignore mid-drill/no-longer-in-lane.
- **Current:** 16 cases, thorough — good.
- **Signal:** pure table cases over result sets.
- **Overlap:** status semantics shared with `sessionStatus` (overlap note above).

### services/admin/adminCoachService.test.ts  (477 lines)
- **Source:** `client/src/services/admin/adminCoachService.ts`
- **Responsibility:** coach-assist scoped row CRUD, data fetch, draft materialization, session-bundle, package import.
- **Must cover:** resolve org scope; create/update/delete scoped by org; no cross-coach leak; materializeDraft one session+N drills; bundle RPC mapping; import validates + maps before RPC; name-conflict handling; oversized rejection before RPC.
- **Current:** 14 cases, behavior-focused — good.
- **Signal:** fake DAO/RPC; assert scoped payloads + rejections.

### services/admin/useAdminStatus.test.tsx
- **Source:** `client/src/services/admin/useAdminStatus.ts`
- **Responsibility:** hook surfacing admin/coach status.
- **Must cover:** loading/ready/error states; reflects service result.
- **Current:** small hook test.
- **Signal:** render hook; assert state.

---

## C3 — Session-draft pipeline (`shared` + `client/src/services/sessionDraft`)

### services/sessionDraft/__tests__/validate.test.ts  (365 lines)  [PWA]
- **Source:** `client/src/services/sessionDraft/validate.ts` (binds `defaultSessionDraftConfig`, re-exports shared validator).
- **Responsibility:** validate session draft + harness result + request.
- **Must cover:** well-formed accept; non-object/null/unknown-field rejects; plan cap + format; version/session/name/drill/item rules; intensity v1–v4; equipment allowlist; description limit; correlation-id rules.
- **Current:** ~41 cases, thorough.
- **Signal:** table cases over the validator output — high value.
- **Overlap:** #3 — duplicates `shared` rules. **Action:** test only the *config binding* here; move rule cases to the shared module's suite.

### services/sessionDraft/__tests__/schema.test.ts  (207 lines)
- **Source:** `shared/sessionDraft/schema.ts` (`buildDraftJsonSchema`).
- **Responsibility:** JSON schema for the LLM contract.
- **Must cover:** every field documented; enums derived from shared config; equipment restricted to enabled; mirrors validator limits; accepts the prompt example (schema ⇄ validator agree); rejects out-of-contract values.
- **Current:** 10 cases, good — keeps schema and validator in lockstep.
- **Signal:** assert schema accepts/rejects the same samples the validator does.

### services/sessionDraft/__tests__/format.test.ts  (182 lines)
- **Source:** `shared/sessionDraft/format.ts` (`formatDrillLine`, `formatDraft`, `describeDraftProblem`, `describeHarnessResultProblem`).
- **Responsibility:** human-readable draft rendering + problem diagnostics.
- **Must cover:** one-line render; optional-field omission; equipment join; valid→null problem; names offending step/field; plan-line budget advice.
- **Current:** 19 cases, solid.
- **Signal:** assert rendered string / problem object.

### services/sessionDraft/__tests__/distance.test.ts  (69 lines)
- **Source:** `shared/sessionDraft/distance.ts` (`draftDrillDistance`, `draftTotalDistance`).
- **Responsibility:** distance math for drafts (single source of truth — overlap #4).
- **Must cover:** item×itemReps×drillReps; drill-level reps when items unrolled; zero for empty; total across session; single-drill-repeat.
- **Current:** 5 cases, focused.
- **Signal:** table cases. **Action:** other suites (sessionSnapshot, runHistory, evals) must use this, not re-derive.

### services/sessionDraft/__tests__/sanitize.test.ts  (57 lines)
- **Source:** `shared/sessionDraft/sanitize.ts` (`sanitizePrompt`).
- **Responsibility:** redact PII (names, emails, phones) from the prompt.
- **Must cover:** case-insensitive whole-word name redaction; punctuation-surrounded; substring-not-whole-word untouched; email/phone redaction; each category reported once; empty result safe; no raw removed values leaked.
- **Current:** 9 cases, thorough — good.
- **Signal:** assert redacted text + reported categories.

### services/sessionDraft/__tests__/context.test.ts  (61 lines)
- **Source:** `shared/sessionDraft/...` context builder (`buildSessionDraftContext`).
- **Responsibility:** build AI context with allow-listed fields, recent-session cap, name sanitization.
- **Must cover:** only allow-listed fields; recent sessions capped at 2; group names sanitized vs known swimmer names; redacted placeholder non-empty; never carries names/notes/ids/labels/counts.
- **Current:** 5 cases, solid.
- **Signal:** assert context object shape + absence of PII.

### services/sessionDraft/__tests__/seed.test.ts  (18 lines)
- **Source:** `shared/sessionDraft/seed.ts`.
- **Responsibility:** draft seed constant.
- **Must cover:** schemaVersion 1, empty name, never accepted as final.
- **Current:** 2 cases — fine.

### services/sessionDraft/__tests__/apply.test.ts  (104 lines)
- **Source:** `client/src/services/sessionDraft/apply.ts` (`mapDraftToSessionAndDrills`, `applySessionDraft`).
- **Responsibility:** map validated draft → session+drills; persist; rollback.
- **Must cover:** distance + dominant-stroke derivation; preserve supported item fields; neutral app defaults; unreviewed marker only when needed; id generation; create/rollback/nothing-on-invalid.
- **Current:** 9 cases, good.
- **Signal:** assert mapped session/drills + Dexie state; rollback = no rows.

---

## C4 — Session package validation (`client/src/services/sessionPackage`)

### services/sessionPackage/__tests__/validate.test.ts  (210 lines)
- **Source:** `shared/sessionPackage/validate.ts`.
- **Responsibility:** validate v1 session package structure + limits.
- **Must cover:** rich packages accepted + structure preserved; empty sessions/drills; custom equipment + free-text intervals; wrong format/version rejected; unknown keys at every level; invalid strokes/timestamps; numeric/array shapes; every structural limit enforced.
- **Current:** 8 grouped cases, thorough — good.
- **Signal:** table cases; the "rejects unknown keys at every level" case is high value.
- **Overlap:** validation vs `sessionPackageService` orchestration — keep separate (this = contract, that = I/O).

---

## C5 — Sync engine (`client/src/sync`)  ⚠️ 8 suites, densest cluster

### sync/__tests__/syncStore.test.ts  (245 lines)
- **Source:** `client/src/sync/syncStore.ts`.
- **Responsibility:** pending-change capture, org scoping, apply-remote, cursors, dependency order.
- **Must cover:** local create → pending scoped to org; unclaimed → home org only (never foreign active org); late capture doesn't revert claim; parent-before-dependent ordering; active run history not pending; tombstone retention; applyRemote doesn't re-enqueue; cursor round-trip per org/table.
- **Current:** 14 cases, thorough.
- **Signal:** assert pending set + applied state from in-memory store.
- **Overlap:** #6 — `accountIsolation` + `conflictResolution` re-test parts of this. Keep this as the *state* owner.

### sync/__tests__/syncService.test.ts  (554 lines)
- **Source:** `client/src/sync/syncService.ts`.
- **Responsibility:** orchestration — queue, first-merge gate, push/pull, history backfill.
- **Must cover:** queue active-run children on completion; backfill local-only history with IDs; reconcile newer cloud before upload; first-sync gate (empty / catalog-only / coach-authored prompt / synced-no-reprompt); syncNow pushes then applies; swallows transport errors.
- **Current:** 18 cases, thorough.
- **Signal:** fake transport; assert sync state + pending after run.
- **Overlap:** orchestration vs store — ensure service drives store, doesn't re-assert store invariants.

### sync/__tests__/accountIsolation.test.ts  (93 lines)
- **Source:** sync store/service isolation.
- **Responsibility:** cross-account data never leaks.
- **Must cover:** A's pending not pushed when active org is B; unclaimed → canonical org.
- **Current:** 2 cases.
- **Overlap:** duplicates `syncStore` claimable tests (#6). **Action:** merge into syncStore's isolation group or keep only the *service-level* cross-account push assertion.

### sync/__tests__/conflictResolution.test.ts  (144 lines)
- **Source:** conflict resolution policy.
- **Responsibility:** resolve remote/local/history-delete conflicts; retry tombstone.
- **Must cover:** resolve remote applies + clears; resolve local re-pushes; history delete → remote; retry tombstone vs latest rev; failed resolution reported.
- **Current:** 5 cases.
- **Overlap:** `syncStore.applyRemote` conflict metadata overlaps (#6). Keep policy here, state in store.

### sync/__tests__/failureContainment.test.ts  (161 lines)
- **Source:** failure handling.
- **Responsibility:** local commit survives push failure; syncNow keeps pending + retries; one error event per failure; pull failure resumable.
- **Must cover:** 4 cases above.
- **Overlap:** overlaps `syncRecovery` (#6). **Action:** carve a hard line — containment = *during a run*, recovery = *after setup/restart*.

### sync/__tests__/firstMerge.test.ts  (132 lines)
- **Source:** first-merge reconciliation.
- **Responsibility:** dedupe starter sessions by catalogKey; push local-only when no cloud match.
- **Must cover:** 2 cases.
- **Signal:** assert merged row set + pending after merge.

### sync/__tests__/syncRecovery.test.ts  (143 lines)
- **Source:** recovery after org-setup failure / error dismiss.
- **Responsibility:** retry after setup fails; init state while resolving; keep transport reason; failed first-merge reported; dismiss clears error not data.
- **Must cover:** 5 cases.
- **Overlap:** see failureContainment (#6).

### sync/__tests__/SupabaseSyncTransport.test.ts  ⚠️ 619 lines
- **Source:** `client/src/sync/SupabaseSyncTransport.ts`.
- **Responsibility:** row mapping (toCloud/fromCloud), push (insert/guarded update/conflict), pull (probe + history backfill).
- **Must cover:** snake_case↔camelCase mapping incl. omitting local-only markers; history mapping + snapshot round-trip; push server-timestamp/new-rev/conflict/stale-rev; pull probe cursors + table restriction + fan-out fallback; history backfill filters + tombstones + pool/name round-trip.
- **Current:** 30 cases, very thorough — good signal.
- **Signal:** fake Supabase client; assert mapped rows + query args.
- **Overlap:** mapping could be unit-tested without the full push/pull — consider splitting pure `toCloudRow`/`fromCloudRow` into a small pure suite to shrink this file.

### timing/__tests__/liveTiming.test.ts  (105 lines)
- **Source:** `client/src/timing/liveTiming.ts` (`LiveTimingStore`).
- **Responsibility:** per-swimmer start/lap/done timing; effective start/done; drill/swimmer clear; version bump.
- **Must cover:** record + read timing; individual beats group; batchStop group-done; aggregate drill timing; clear scoping; version bump; backward-compatible surface.
- **Current:** 11 cases, solid.
- **Signal:** assert timing maps.
- **Overlap:** #1 — projection math also in saveFlow/runs.

### timing/__tests__/timestampStore.test.ts  (162 lines)
- **Source:** `client/src/timing/timestampStore.ts`.
- **Responsibility:** base timestamp store (get/set, batchStop, clear*, effectiveStart/Done, key helpers).
- **Must cover:** get/set + version; batchStop semantics + no overwrite + single bump; clear scoping; effective start/done precedence + fallback; key patterns.
- **Current:** 15 cases, thorough.
- **Signal:** assert store contents.
- **Overlap:** effective-start/done also in liveTiming — keep here as the primitive, liveTiming as the composed view.

---

## C6 — DB / migrations / config (`client/src/db`, `client/src/__tests__`)

### db/__tests__/adminDao.test.ts  (204 lines)
- **Source:** `client/src/db/adminDao.ts`.
- **Responsibility:** coach-assist DAO over admin service (drills/sessions sort+map, bundle writes, conflict-null).
- **Must cover:** sort+map fields; `addDrill` payload; update delegation; bundle write (one call); name-conflict → null; import delegation; throws when no coach.
- **Current:** 7 cases, solid.
- **Signal:** fake admin service; assert payloads.

### db/__tests__/backup.test.ts  (258 lines)
- **Source:** `client/src/db/backup.ts`.
- **Responsibility:** export/import versioned snapshot, legacy v5 normalize, granular resets, localStorage backup.
- **Must cover:** export versioned+timestamped; round-trip; v5 legacy import; older/newer version reject; malformed/no-tables reject; validation-fail touches nothing; granular resets (swimmers keep sessions, sessions keep runs); localStorage auto-backup + restore; stale backup cleared on wipe; persistence-unavailable report.
- **Current:** 17 cases, thorough — good.
- **Signal:** assert exported JSON + Dexie state after import/reset.

### db/__tests__/daoFacade.test.ts  (145 lines)
- **Source:** `client/src/db/dao.ts` (facade).
- **Responsibility:** route local vs coach-assist mode to Dexie vs adminDao.
- **Must cover:** coach mode delegates to adminDao (not Dexie) for sessions/drills/library/package; local mode delegates to Dexie (not adminDao); no local seeding/dismissal in coach mode.
- **Current:** 9 cases, solid.
- **Signal:** assert which backend received the call per mode.

### db/__tests__/recordMigration.test.ts  (62 lines)
- **Source:** `client/src/db/recordMigration.ts` (`normalizeLegacyBackupTables`).
- **Responsibility:** v5 → camelCase field rename.
- **Must cover:** rename all v5 fields; camelCase wins over legacy; unrelated preserved; idempotent + no input mutation.
- **Current:** 3 cases, focused.
- **Signal:** assert normalized object.

### db/__tests__/schemaMigration.test.ts  (83 lines)
- **Source:** migration runner (v5 → latest).
- **Responsibility:** full record migration preserving relationships/indexes.
- **Must cover:** converts all v5 fields, preserves relationships + indexes.
- **Current:** 1 case (whole migration) — broad but single.
- **Signal:** run migration on seeded v5 DB; assert post-state. Good as integration; consider a few targeted relationship assertions.

### db/__tests__/schemaMigrationV7.test.ts  (99 lines)
- **Source:** v7→v8 migration.
- **Responsibility:** add new fields without data loss.
- **Must cover:** preserves rows + adds fields.
- **Current:** 1 case.
- **Overlap:** similar shape to `schemaMigration.test.ts`. **Action:** keep both (different versions) but share a helper + assert the *new* fields explicitly.

### db/__tests__/seedSessions.test.ts  (37 lines)
- **Source:** `client/src/db/seedSessions.ts`.
- **Responsibility:** seed catalog session once (dismissal guard).
- **Must cover:** seeds when not dismissed; skips when dismissed.
- **Current:** 2 cases — fine.

### __tests__/config.test.ts  (49 lines)
- **Source:** `client/src/config.ts`.
- **Responsibility:** runtime config resolution (env vs legacy localStorage).
- **Must cover:** test config when set; legacy localStorage ignored in favor of env.
- **Current:** 2 cases.
- **Signal:** assert resolved config; high value (prevents env leakage).

### __tests__/i18n-coverage.test.ts  (11 lines)
- **Source:** i18n bundles.
- **Responsibility:** Hebrew bundle parity with English keys.
- **Must cover:** every EN key present in HE.
- **Current:** 1 case — valuable guard.
- **Signal:** static key-set comparison; keep.

---

## C7 — Components: forms & modals (`client/src/components/__tests__`)  [part 1]

### components/__tests__/CustomSelect.test.tsx  (45 lines)
- **Source:** `client/src/components/CustomSelect.tsx`.
- **Responsibility:** accessible select.
- **Must cover:** renders selected label; opens options; onChange; className passthrough.
- **Current:** 4 cases — fine.
- **Signal:** role/name queries + user-event.

### components/__tests__/DrillEditorModal.test.tsx  (114 lines)
- **Source:** `client/src/components/DrillEditorModal.tsx`.
- **Responsibility:** drill step editor modal.
- **Must cover:** hidden when closed; title; onSave/onClose; pre-fill edit; Escape dismisses stroke confirm but keeps modal; label association.
- **Current:** 7 cases, solid.
- **Signal:** RTL + user-event; assert callbacks + labels.

### components/__tests__/LaneEditorModal.test.tsx  (123 lines)
- **Source:** `client/src/components/LaneEditorModal.tsx`.
- **Responsibility:** lane/group editor modal.
- **Must cover:** renders when open; onClose; lane sections per group; assigned swimmers.
- **Current:** 4 cases.
- **Signal:** assert visible sections.

### components/__tests__/SessionPackageImportModal.test.tsx  (166 lines)
- **Source:** `client/src/components/SessionPackageImportModal.tsx`.
- **Responsibility:** package import flow (preview → confirm → import).
- **Must cover:** preview without write; file/package errors near input; name-conflict suggestion; cancel; import only after confirm + View session; remote failure not claimed success; keyboard-dismissible focus.
- **Current:** 7 cases, thorough — good.
- **Signal:** assert import callback fired exactly on confirm; no premature write.

### components/__tests__/SwimmerFormModal.test.tsx  (159 lines)
- **Source:** `client/src/components/SwimmerFormModal.tsx`.
- **Responsibility:** create/edit swimmer modal.
- **Must cover:** hidden when closed; New/Edit title; pre-fill; onSave with data; onClose; duplicate block (case-insensitive) + reserved error label; edit-self allowed; re-link to existing.
- **Current:** 11 cases, solid.
- **Signal:** user-event + role queries; assert onSave payload.
- **Overlap:** #5 — promote/re-link also in SwimmerRows/BreakoutCard.

### components/__tests__/SwimmerRows.test.tsx  ⚠️ 330 lines
- **Source:** `client/src/components/SwimmerRows.tsx`.
- **Responsibility:** active + saved swimmer rows, modal flows, gestures.
- **Must cover:** promote quick→roster (create); re-link to existing; edit roster; block re-point to allocated; onSwimmerSaved; saved-row variants.
- **Current:** 10 cases (2 describe blocks: Active + Saved).
- **Signal:** user-event; assert callbacks.
- **Overlap:** #5 — duplicate promote logic between Active/Saved describes + SwimmerBreakoutCard. **Action:** parametrize "promote from any row".

### components/__tests__/swimmerRowGesture.test.tsx  (144 lines)
- **Source:** `client/src/components/SwimmerRows.tsx` gesture layer.
- **Responsibility:** desktop right/middle click inert; touch suppresses context menu; primary hold opens menu.
- **Must cover:** left marks done; right/middle inert; right hold no menu (desktop); context menu kept desktop / suppressed touch; primary hold opens.
- **Current:** 7 cases, focused — good.
- **Signal:** fireEvent pointer/mouse; assert no state change.

### components/__tests__/Table.test.tsx  (184 lines)
- **Source:** `client/src/components/Table.tsx` (`RunHistoryTable`).
- **Responsibility:** run-history table render, expand, delete, attendee list.
- **Must cover:** render name/date/pool; empty state; expand details; getRunHistory with swimmerId; delete after confirm; attendee "and N more"; link to swimmer; last-attended mark.
- **Current:** 9 cases, solid.
- **Signal:** RTL; assert rows + delete callback.

---

## C8 — Components: display & layout (`client/src/components/__tests__`)  [part 2]

### components/__tests__/AccountIndicator.test.tsx  (56 lines)
- **Source:** `client/src/components/AccountIndicator.tsx`.
- **Responsibility:** signed-in avatar/initials indicator.
- **Must cover:** hidden when loading/signed-out; settings link + initials; avatar metadata.
- **Current:** 3 cases — fine.
- **Overlap:** #7 — with AccountSection/AuthProvider.

### components/__tests__/AccountSection.test.tsx  ⚠️ 346 lines
- **Source:** `client/src/components/AccountSection.tsx`.
- **Responsibility:** account UI — sign-in/out, persistence, sync state, analytics.
- **Must cover:** signed-out honest copy; no-Supabase explanation; offline/initializing disables controls; persistence passthrough; signed-in identity + sign-out; test-user gating; error+re-enable; **sign_in/sign_out analytics tracking**; last-sync + Sync now; error retry/dismiss.
- **Current:** 16 cases, thorough.
- **Signal:** RTL + analytics spy; assert visible copy + tracked events.
- **Overlap:** #7 — sign-in tracking also asserted in `Settings.test.tsx`; AuthProvider overlaps sign-in delegation. **Action:** AccountSection owns sign-in/out tracking; Settings owns *settings* actions only.

### components/__tests__/DraftSessionPanel.test.tsx  ⚠️ 336 lines
- **Source:** `client/src/components/ai/DraftSessionPanel.tsx`.
- **Responsibility:** AI draft editor — rename, step/drill edit, equipment, reps, save/discard.
- **Must cover:** exposes proposal + name; subtitle/total; rename; edit reps/distance/interval/stroke/intensity (incl. clear intensity); equipment toggle; set repeats; rename/add/remove drill (bounds); move up/down (bounds); disable save when invalid; onSave/onDiscard; disable while saving.
- **Current:** 28 cases, very thorough — good but large.
- **Signal:** RTL + user-event; assert callbacks + disabled state.
- **Overlap:** step/drill edit semantics overlap `DrillEditorModal` + `sessionDraft/apply`. **Action:** keep panel interaction tests; ensure field *validation* lives in the shared schema/validate suites, not re-tested here.

### components/__tests__/DrillsSection.test.tsx  (219 lines)
- **Source:** `client/src/components/live/DrillsSection.tsx`.
- **Responsibility:** live-deck drill grouping, progress, marking.
- **Must cover:** collapse repeat→one row + count; single drill unchanged; inline vs chevron threshold; chevron direction; re-expand; toggle details; empty placeholder; multi-step nesting; progress counts; group-complete gating; jump to next; per-row toggle.
- **Current:** 18 cases, thorough — good.
- **Signal:** assert rendered grouping + completion state.
- **Overlap:** grouping logic also in `utils/sessionProgress` (pure) — keep UI here, logic there; ensure they assert the same contract.

### components/__tests__/Icon.test.tsx  (81 lines)
- **Source:** `client/src/components/Icon.tsx`.
- **Responsibility:** material icon wrapper (size/color/fill/className).
- **Must cover:** default; size class per size; color class; fill style; className merge.
- **Current:** 7 cases — fine (cheap, keep).

### components/__tests__/Layout.test.tsx  (50 lines)
- **Source:** `client/src/components/Layout.tsx`.
- **Responsibility:** app shell; disables owner active-run subscription while assisting.
- **Must cover:** 1 case (coach-assist gating).
- **Current:** 1 case — focused, keep.
- **Signal:** assert subscription not opened in assist mode.

### components/__tests__/SwimmerBreakoutCard.test.tsx  (122 lines)
- **Source:** `client/src/components/SwimmerBreakoutCard.tsx`.
- **Responsibility:** focused-swimmer breakout view.
- **Must cover:** render focused swimmer + lane badge; remove-from-focus (not lane); start handler; saved row when completed.
- **Current:** 4 cases.
- **Signal:** assert callbacks + rendered state.
- **Overlap:** #5 — promote flow overlaps SwimmerRows.

---

## C9 — Pages / context / hooks (`client/src/pages`, `client/src/context`, `client/src/hooks`)

### pages/__tests__/AiSessionDraft.test.tsx  (184 lines)
- **Source:** `client/src/pages/AiSessionDraft.tsx`.
- **Responsibility:** AI composer page — generate, edit, save/discard proposal.
- **Must cover:** composer in named section; proposal beside prompt (no save); save→list on confirm; keep proposal + report failure; save edited not generated; discard; empty until generated; confirm before regenerate; keep on cancel.
- **Current:** 9 cases, solid.
- **Signal:** RTL; assert navigation + proposal state.
- **Overlap:** proposal editing overlaps `DraftSessionPanel` (C8). Keep page-level flow here, panel interaction there.

### pages/__tests__/AuthCallback.test.tsx  (96 lines)
- **Source:** `client/src/pages/AuthCallback.tsx`.
- **Responsibility:** OAuth callback routing/error states.
- **Must cover:** no-params → Settings; no-nav while loading; signed-in → replace; signed-out error state; OAuth error → Settings; non-cancel error state; cancellation in hash.
- **Current:** 7 cases, solid.
- **Signal:** assert navigation target per state.

### pages/__tests__/SessionDetail.test.tsx  (193 lines)
- **Source:** `client/src/pages/SessionDetail.tsx`.
- **Responsibility:** session detail — metadata/drill editors, Coach-Assist gating, failure reporting.
- **Must cover:** skip local seeding/active-run in Coach Assist; keep metadata editor open + report save failure; keep drill editor open + report create/update failure.
- **Current:** 4 cases.
- **Signal:** assert editor stays open + error surfaced.

### pages/__tests__/SessionsListImportExport.test.tsx  (162 lines)
- **Source:** `client/src/pages/SessionsList.tsx` import/export actions.
- **Responsibility:** import/export UI affordances + Coach-Assist gating.
- **Must cover:** accessible import icon + open; per-session export icon; export without navigating; export failure no download; no owner-history/template-delete in Coach Assist; new-template failure keeps form open.
- **Current:** 6 cases, solid.
- **Signal:** RTL; assert callbacks + gating.

### pages/__tests__/Settings.test.tsx  (189 lines)
- **Source:** `client/src/pages/Settings.tsx`.
- **Responsibility:** settings page + analytics tracking for *settings* actions.
- **Must cover:** track set_equipment/pool_length/request_persist/clear_data/cleanup_run; don't track cleanup on failure.
- **Current:** 6 cases.
- **Signal:** analytics spy.
- **Overlap:** #7 — sign-in tracking belongs to AccountSection, not here.

### context/__tests__/AuthProvider.test.tsx  (102 lines)
- **Source:** `client/src/context/AuthProvider.tsx`.
- **Responsibility:** auth provider state machine.
- **Must cover:** loading→signed_out on null; signed_in on restore; stays out on reject; follows onAuthChange + unsubscribe; delegates actions with persist value.
- **Current:** 5 cases, solid.
- **Signal:** render provider + assert context value.
- **Overlap:** #7 — sign-in delegation overlaps AccountSection UI.

### context/__tests__/CoachAssistContext.test.tsx  (46 lines)
- **Source:** `client/src/context/CoachAssistContext.tsx`.
- **Responsibility:** coach-assist selection.
- **Must cover:** selectCoach configures adminDao; exit clears.
- **Current:** 1 case.
- **Signal:** assert adminDao configured.

### context/__tests__/LiveSessionContext.test.ts  (242 lines)
- **Source:** `client/src/context/LiveSessionContext.tsx` (reducer).
- **Responsibility:** live-session reducer — groups, swimmers, drills, strokes, moves, clears.
- **Must cover:** INIT_FROM_RUN; CLEAR; SWIMMER_COMPLETE; SET_GROUP_DRILL/ALL; CLEAR_GROUP_SWIMMER_DATA; SWIMMER_CLEAR; SWIMMER_LAP_STROKE_COUNT (scoped); ADD/REMOVE_GROUP (empty vs occupied); MOVE_SWIMMER_TO_GROUP (reset + not-found).
- **Current:** 11 cases, thorough — good (pure reducer, clear signal).
- **Signal:** assert resulting state object per action. **Action:** this is the canonical live-state contract; ensure components assert *through* it rather than re-deriving.

### hooks/__tests__/useActiveRun.test.tsx  (43 lines)
- **Source:** `client/src/hooks/useActiveRun.ts`.
- **Responsibility:** subscribe to active run.
- **Must cover:** no Dexie subscription when disabled; cleanup on disable.
- **Current:** 1 case.
- **Signal:** assert subscription lifecycle.

---

## C10 — Utils & pure helpers (`client/src/utils`)

### utils/__tests__/drillHelpers.test.ts  (90 lines)
- **Source:** `client/src/utils/drillHelpers.ts` (Levenshtein, findSimilarDrills).
- **Responsibility:** fuzzy drill-name matching.
- **Must cover:** Levenshtein identity/distance/empty; ratio edge cases; findSimilar exact=1, similar>0.5, stroke/label reduce score, empty existing, custom threshold, human-readable descriptions.
- **Current:** 13 cases, solid.
- **Signal:** table cases — high value.

### utils/__tests__/sessionPackageFile.test.ts  (99 lines)
- **Source:** `client/src/utils/sessionPackageFile.ts`.
- **Responsibility:** file read/write, size caps, download.
- **Must cover:** reject oversize before read; parse JSON regardless of extension; malformed JSON; reject oversize before download; download with extension; stable fallback filename.
- **Current:** 6 cases, solid.
- **Signal:** stub `Blob`/download; assert parse result / error.

### utils/__tests__/sessionProgress.test.ts  (171 lines)
- **Source:** `client/src/utils/sessionProgress.ts` (groupDrillRows, stripRepPrefix, buildDrillGroup, progress).
- **Responsibility:** live-deck row grouping + progress.
- **Must cover:** single vs repeated grouping; drillIndex/legacy grouping; null/undefined distinct; prefix strip; single vs multi-step split; no merge on repeated label; done counting; partial progress; jump-to-incomplete; empty group.
- **Current:** 18 cases, thorough — good.
- **Signal:** pure table cases.
- **Overlap:** grouping contract shared with `DrillsSection` UI (C8) — keep logic here, UI there.

### utils/__tests__/sessionSnapshot.test.ts  (170 lines)
- **Source:** `client/src/utils/sessionSnapshot.ts` (computeDrillMetrics, buildSessionSnapshot).
- **Responsibility:** drill metrics + session snapshot.
- **Must cover:** distance sum; strokeMix totals; setCount; dominantStroke (greatest contributor / tie→first item / freestyle-all / mixed-empty); missing repeatCount=1; snapshot preserves authored fields + order; records name/notes/version; omits visibility.
- **Current:** 15 cases, solid.
- **Signal:** assert metrics object.
- **Overlap:** #4 — distance math should delegate to `shared/sessionDraft/distance.ts`.

### utils/lapEditing.test.ts  (standalone)
- **Source:** `client/src/utils/lapEditing.ts`.
- **Responsibility:** lap add/remove/move + cumulative↔split conversion.
- **Must cover:** add/remove/move; split→cumulative; cumulative→split; boundary (first/last); immutability.
- **Current:** (not enumerated here — pair with source). 
- **Signal:** pure table cases — high value. **Action:** confirm it is covered; this is foundational for `buildLaneResult`.

### utils/routeMeta.test.ts  (standalone)
- **Source:** `client/src/utils/routeMeta.ts`.
- **Responsibility:** route metadata (title, breadcrumb).
- **Must cover:** each route's metadata correct; unknown route handling.
- **Current:** (pair with source).
- **Signal:** assert returned metadata map.

---

## C11 — Supabase Edge Functions (`supabase/functions/*_test.ts`)

### ai-session-harness/agent/config_test.ts  (50 lines)
- **Source:** `agent/config.ts` (provider timeout/token from env).
- **Must cover:** fallback to default when unset/unusable; positive override read.
- **Current:** 5 cases — fine.

### ai-session-harness/agent/debug_test.ts  (64 lines)
- **Source:** `agent/debug.ts`.
- **Must cover:** off when unset/non-"true"; log one prefixed JSON line when on; emits on serialize failure.
- **Current:** 4 cases — fine.

### ai-session-harness/agent/output_test.ts  (97 lines)
- **Source:** `agent/output.ts` (`validateHarnessResult`, `validateSessionDraft`).
- **Must cover:** accepts draft/not_actionable; truncates overlong plan lines; rejects too-many plans/unknown outcome; rejects bad intensity/equipment/distance/repeat/interval.
- **Current:** 12 cases.
- **Overlap:** #3 — re-tests shared validator. **Action:** keep only the *harness* layer (truncation, outcome mapping); defer rule checks to shared suite.

### ai-session-harness/agent/prompt_test.ts  ⚠️ 321 lines
- **Source:** `agent/prompt.ts`.
- **Responsibility:** system/user prompt assembly + schema embedding + example validity.
- **Must cover:** equipment/pool/strokes/intensity from shared config; example is itself valid; example uses only enabled equipment; nesting/repetition guidance correct; schema embedded before example; plan limits; language rules.
- **Current:** 34 cases, thorough — high value (keeps prompt + validator + schema consistent).
- **Signal:** assert prompt string contains the contract clauses; validate the embedded example.

### ai-session-harness/agent/provider_test.ts  ⚠️ 321 lines
- **Source:** `agent/provider.ts` (`callProvider`, `callProviderStream`).
- **Responsibility:** LLM HTTP adapter — error mapping, JSON recovery, streaming, timeout.
- **Must cover:** missing key→error; non-2xx→status; 429→rate_limited (+Retry-After/default); 503→unavailable; missing message→shape; bounded max_tokens, no temperature; fenced/prose JSON recovery; non-JSON reject; timeout; stream delta reconstruction; stream error/timeout surfacing.
- **Current:** 19 cases, thorough — good.
- **Signal:** fake fetch + fake clock; assert mapped error + reconstructed output.

### ai-session-harness/analytics/emitter_test.ts  (57 lines)
- **Source:** `analytics/emitter.ts`.
- **Responsibility:** async trace insert, swallow failures.
- **Must cover:** schedules insert, never throws sync; swallows insert failure.
- **Current:** 2 cases — fine.

### ai-session-harness/harness/handler_test.ts  ⚠️ 456 lines
- **Source:** `harness/handler.ts` (`createHandler`).
- **Responsibility:** HTTP handler — auth, validation, rate-limit, agent orchestration, streaming, retries, traces.
- **Must cover:** 401 missing/token/user; 400 body/prompt/context/seed; 503 rate-store unavailable; 429 retry-after; 502 invalid output/other; 408 timeout; 429 provider; stream frames + error frames; validation retry up to cap + advice feed; trace recording.
- **Current:** 29 cases, thorough — good.
- **Signal:** inject fake deps (auth, rate-limit, agent, emitter); assert status + body + trace calls. **Action:** this is the harness contract; keep, but ensure it calls the agent via injection (no real network).

### ai-session-harness/harness/request_test.ts  (61 lines)
- **Source:** `harness/request.ts` (`validateRequest`).
- **Responsibility:** request shape validation.
- **Must cover:** well-formed; over-long prompt; non-empty seed name; unexpected context field; unsupported equipment; caps on groupNames/recentSessions; bad recent-session field.
- **Current:** 8 cases — fine.

### admin-coach-assist/api/handler_test.ts  ⚠️ 481 lines
- **Source:** `api/handler.ts`.
- **Responsibility:** coach-assist HTTP router — ownership, routing (URL vs body.path), CORS.
- **Must cover:** non-owner→403; owner→isOwner + scoped rows; token missing/unverifiable→403; GET/POST route coverage; body.path vs URL priority; import validation before RPC.
- **Current:** 20 cases, thorough — good.
- **Signal:** inject fake deps; assert status + scoped payloads.

### admin-coach-assist/api/http_test.ts  (15 lines)
- **Source:** `api/http.ts` (CORS headers).
- **Must cover:** CORS allows POST/PATCH/DELETE; json response carries CORS.
- **Current:** 2 cases — fine.

### admin-coach-assist/model/validate_test.ts  (104 lines)
- **Source:** `model/validate.ts` (scoped write validation).
- **Must cover:** reject missing orgId; force created_by=coach; library_drills never null-org; reject unknown table; preserve non-reserved fields; forward rich drill fields; ScopedWriteError message.
- **Current:** 7 cases, solid.
- **Signal:** assert thrown error + sanitized payload.

### admin-coach-assist/service/adminService_test.ts  ⚠️ 477 lines
- **Source:** `service/adminService.ts`.
- **Responsibility:** coach org resolution + scoped CRUD + draft/package materialization.
- **Must cover:** resolveCoachOrg (one/missing/multiple orgs); listCoaches + batch cap; create/update/delete scoped; getCoachData scoped; materializeDraft one session+N drills; bundle RPC mapping; import validation before RPC + byte/field limits + name conflict; error propagation.
- **Current:** 14 cases, thorough — good.
- **Signal:** fake DAO/RPC; assert scoped payloads.
- **Overlap:** mirrors client `adminCoachService.test.ts` (PWA) at the contract level — acceptable (different runtime), but ensure rule changes are made in one place.

---

## C12 — Evals (`supabase/evals`)

### evals/scorer_test.ts  (257 lines)
- **Source:** `supabase/evals/scorer.ts`.
- **Responsibility:** score a generated draft against requirements (distance, distinct names/intensities/descriptions, outcome).
- **Must cover:** pass when all match; report each unmet; outcome mismatch; not_actionable short-circuit; totalDistance (drill+item reps) + distinctDrillNames + descriptionMentions + distinctIntensities + distinctItemDescriptions + anyOf.
- **Current:** 14 cases, thorough — good.
- **Signal:** table cases.
- **Overlap:** #3/#4 — distance/name logic duplicates `shared/sessionDraft/*`. **Action:** import the shared distance/util helpers rather than re-implementing in the eval.

---

## Appendix — suggested execution order for iteration 2

1. **Overlap #1** (buildLaneResult consolidation) — biggest win, touches `runs`, `saveFlow`, `liveTiming`, `timestampStore`.
2. **Overlap #2** (API vs service delegation) — convert both layers' pass-through to parametric; reclaim the most lines for least risk.
3. **Overlap #3 / #4** (shared sessionDraft contract as single source of truth) — PWA wrapper + evals.
4. **Overlap #6** (sync 8-suite audit) — dedupe scenarios across store/service/isolation/conflict/failure/recovery.
5. **Overlap #5 / #7** (swimmer flows, auth UI) — draw boundaries, merge duplicated describes.
6. Per remaining record: confirm "must cover" is met, drop weak assertions, tighten signal.

Each task = one record above + its source/test files + the "must cover" checklist +
the specific overlap action. Verify with `npm run test` (client) and
`deno task test` (per function dir) before marking done.
