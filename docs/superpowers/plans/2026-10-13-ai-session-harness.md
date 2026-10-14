# AI Session Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in swim coach turn a sanitized plain-language request into a complete, rich, editable, discardable session draft without sending swimmer records to the LLM.

**Architecture:** The client owns the canonical draft contract, an empty session seed, local prompt sanitizer, structural context builder, and one validated writer. The Edge Function gives the seed plus coach intent to one structured JSON call and returns a complete session object or a non-actionable result. The writer atomically creates the session and drills through a draft-specific DAO transaction that bypasses the existing `addDrill()` library side effect.

**Provider assumption for review:** The first adapter targets an OpenAI-compatible chat-completions JSON-response endpoint. The actual provider URL, key, and model ID are deployment settings, not client choices; confirm the provider supports the required JSON response mode before deployment.

**Tech Stack:** React 19, TypeScript strict, Dexie 4, Supabase Auth/Edge Functions/Postgres, Deno, Vitest, existing Supabase SQL/hosted security checks. No new client runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-13-ai-session-harness-design.md`

## Global Constraints

- No `any`, `console.log`, `console.warn`, or `console.error`; use `unknown` and narrow it.
- UI pages/components never import `db/` or DAO code; preserve UI → API → Services → DAO → Dexie.
- DAO methods remain persistence-only; mapping, validation, lifecycle decisions, and context selection belong in services.
- Do not edit an applied migration. Migration filename prefixes must be globally unique.
- The private rate-limit schema/table/RPC must not grant access to `anon` or `authenticated`; do not add public tables or RLS policies.
- Apply the rate-limit migration to hosted Supabase and pass `supabase/tests/verify-hosted.sh` before merging code that calls it.
- `Session.aiDraftStatus` is local-only and optional; do not bump Dexie schema version or sync this property.
- Draft persistence must not call `addDrill()`: that method also writes to `libraryDrills`.
- Every model-emitted content field must be editable in the normal session editor. V1 includes item intensity `v1`–`v4`, interval, and equipment; do not emit stored-but-not-editable `segments`.
- Intensity mapping is `v1 = easy`, `v2 = medium/moderate`, `v3 = strong`, `v4 = hard`; omit intensity if the coach gives no clear effort cue.
- V1 equipment IDs are `fins`, `paddles`, `pullbuoy`, and `snorkel`; only include equipment supplied or clearly specified by the coach.
- No swimmer records or unsanitized free text may be sent to the provider. V1 excludes drill-library contents.
- The Edge Function rejects both unauthenticated requests and Supabase anonymous-auth users; the public anon key alone is not user authentication.
- Playwright coverage for this feature is deferred. Do not add a feature E2E flow until the existing suite is corrected and reliable.
- Keep live LLM evals opt-in; normal checks must need no provider key, network, or spend.
- Update the relevant `docs/context/` files and `App-Tasks-Context.md` as part of the tasks that change those areas.
- No AI attribution trailers in commit messages.

## Review Focus

1. **Prompt asks for swimmer names, or includes a known swimmer name.** Locally redact the known name; a names-only request returns non-actionable, and no roster data is attached. Pin with sanitizer, response-output guard, and non-actionable eval tests in Tasks 2, 5, and 6.
2. **Sanitization removes the whole request or flags an email/phone number.** Show the sanitized editable text and do not call the function with an empty prompt. Pin in Tasks 2 and 5.
3. **Provider returns malformed JSON, unknown fields, unsupported intensity/equipment, invalid stroke, or out-of-range counts—or misreads a step progression.** Return a clear error and persist nothing; do not silently drop fields. Pin in Tasks 2, 4, and 6.
4. **Two tabs submit drafts concurrently, or a marked draft already exists.** Serialize the local slot check/write and return the existing-draft choice without silently replacing it. Pin with simultaneous apply calls in Task 3.
5. **Anonymous-auth JWT, request at the rate limit, provider timeout, or Dexie write failure.** Reject anonymous/over-limit requests before provider spend, and leave no partial session on client failure. Pin in Tasks 1, 3, and 4.

---

## File Structure

**Create:**
- `supabase/migrations/20261013000000_ai_session_harness_rate_limit.sql` — private per-user fixed-window counter and locked-down RPC.
- `supabase/tests/ai_harness_rate_limit_check.sql` — RPC count, retry, and window-reset checks.
- `supabase/functions/ai-session-harness/index.ts` — Deno `serve` entry point.
- `supabase/functions/ai-session-harness/handler.ts` — injectable HTTP handler for auth, limits, provider call, response mapping.
- `supabase/functions/ai-session-harness/prompt.ts` — versioned v1 prompt and response contract.
- `supabase/functions/ai-session-harness/provider.ts` — one OpenAI-compatible JSON-response adapter behind `HarnessProvider`.
- `supabase/functions/ai-session-harness/output.ts` — loose server-side response shape check.
- `supabase/functions/ai-session-harness/index_test.ts` — Deno handler/provider-boundary tests with fakes.
- `client/src/services/sessionDraft/schema.ts` — canonical `SessionDraftV1`, request context, and response types.
- `client/src/services/sessionDraft/seed.ts` — shape-valid, incomplete `SessionDraftSeedV1`; never persisted.
- `client/src/services/sessionDraft/validate.ts` — runtime draft and response validation.
- `client/src/services/sessionDraft/sanitize.ts` — local prompt/context redaction.
- `client/src/services/sessionDraft/context.ts` — allow-listed structural context from local APIs.
- `client/src/services/sessionDraft/apply.ts` — draft validation, single-slot lifecycle, and one writer.
- `client/src/services/sessionDraft/__tests__/validate.test.ts`
- `client/src/services/sessionDraft/__tests__/seed.test.ts`
- `client/src/services/sessionDraft/__tests__/sanitize.test.ts`
- `client/src/services/sessionDraft/__tests__/context.test.ts`
- `client/src/services/sessionDraft/__tests__/apply.test.ts`
- `client/src/api/__tests__/sessions.test.ts` — direct draft API bypasses the harness.
- `client/src/api/sessionDraft.ts` — Edge Function invocation and draft API.
- `client/src/api/__tests__/sessionDraft.test.ts` — mocked invocation/error mapping tests.
- `client/src/pages/AiSessionDraft.tsx` — prompt, sanitized preview, auth/error states, generation.
- `supabase/functions/ai-session-harness/evals/cases.ts` — synthetic committed eval corpus.
- `supabase/functions/ai-session-harness/evals/scorer.ts` — deterministic constraint scoring.
- `supabase/functions/ai-session-harness/evals/scorer_test.ts` — scorer tests.
- `supabase/functions/ai-session-harness/evals/run.ts` — opt-in live provider eval runner.

**Modify:**
- `client/src/db/schema.ts` — optional `Session.aiDraftStatus` only; no Dexie version/index change.
- `client/src/db/dao.ts` — pure atomic `addSessionWithDrills` persistence that does not call `addDrill`.
- `client/src/api/sessions.ts` — expose the direct draft-creation API without changing existing `createSession` behavior.
- `client/src/App.tsx` — register `/sessions/ai` before the parameter route.
- `client/src/pages/SessionsList.tsx`, `client/src/components/SessionCard.tsx` — AI entry point and marked-draft affordance.
- `client/src/pages/SessionDetail.tsx` — review marker, Keep session, and Discard actions.
- `client/src/pages/Privacy.tsx` — disclose prompt/context processing by the selected LLM provider and the sign-in gate.
- `supabase/tests/rls_hardening_check.sql`, `supabase/tests/verify-hosted.sh` — private table/RPC privilege checks.
- `client/src/sync/__tests__/SupabaseSyncTransport.test.ts` — assert the local-only marker is never serialized.
- `docs/context/App-Context.md`, `DB-Context.md`, `UI-Context.md`, `Sessions-Drills-Context.md`, `Test-Context.md`, `App-Tasks-Context.md` — reflect the shipped architecture, data, UI, supported step fields, tests, and task status.

---

### Task 1: Private rate-limit storage (schema first)

**Files:**
- Create: `supabase/migrations/20261013000000_ai_session_harness_rate_limit.sql`
- Create: `supabase/tests/ai_harness_rate_limit_check.sql`
- Modify: `supabase/tests/rls_hardening_check.sql`
- Modify: `supabase/tests/verify-hosted.sh`
- Modify: `docs/context/DB-Context.md`

**Interfaces:**
- Produces `private.ai_session_harness_rate_limits(user_id, window_started_at, request_count)` with one current-window row per user.
- Produces `public.consume_ai_session_harness_rate_limit(p_user_id uuid, p_limit integer, p_window_seconds integer) returns jsonb`, returning `{ "allowed": boolean, "retry_after_seconds": integer }`.
- RPC execution is granted only to `service_role`; table/schema access is revoked from `PUBLIC`, `anon`, and `authenticated`. Pin `search_path` and qualify private objects.

- [ ] **Step 1: Add failing privilege assertions** to `rls_hardening_check.sql` and hosted verification: private table is not directly readable/writable by `anon` or `authenticated`; RPC is executable by `service_role` and not by `PUBLIC`, `anon`, or `authenticated`. Add `ai_harness_rate_limit_check.sql` asserting the RPC allows exactly the configured number within a window, returns a positive retry delay after the limit, and resets the row after its stored window start is forced to expire in the test transaction.
- [ ] **Step 2: Run the local SQL tests** and verify they fail because the private schema/table/RPC do not yet exist.
- [ ] **Step 3: Write the new migration** with the private table and atomic fixed-window check/increment RPC. Expired windows reset the existing user row; do not retain per-request history.
- [ ] **Step 4: Apply pending migrations locally.**

- [ ] **Step 5: Run both local SQL tests.**

```bash
docker exec -i supabase_db_swimsheet psql -U postgres -d postgres -f - < supabase/tests/rls_hardening_check.sql
docker exec -i supabase_db_swimsheet psql -U postgres -d postgres -f - < supabase/tests/ai_harness_rate_limit_check.sql
```

Expected: `RLS_HARDENING_OK` and `AI_HARNESS_RATE_LIMIT_OK`; public table/policy counts remain unchanged.

- [ ] **Step 6: Extend and run hosted verification** for the private schema/table/RPC privileges.

```bash
npm run db:push
./supabase/tests/verify-hosted.sh
```

Expected: migration is recorded, hosted public counts remain 18 tables / 52 policies, and all checks pass. This schema-first deployment must precede merging/deploying the Edge Function.

- [ ] **Step 7: Update `DB-Context.md`** with the migration number, private store/RPC grants, and hosted verification result.
- [ ] **Step 8: Commit** as `feat(db): add private AI request rate limit`.

---

### Task 2: Draft contract, sanitizer, and context builder

**Files:**
- Create: `client/src/services/sessionDraft/schema.ts`
- Create: `client/src/services/sessionDraft/seed.ts`
- Create: `client/src/services/sessionDraft/validate.ts`
- Create: `client/src/services/sessionDraft/sanitize.ts`
- Create: `client/src/services/sessionDraft/context.ts`
- Create: `client/src/services/sessionDraft/__tests__/validate.test.ts`
- Create: `client/src/services/sessionDraft/__tests__/seed.test.ts`
- Create: `client/src/services/sessionDraft/__tests__/sanitize.test.ts`
- Create: `client/src/services/sessionDraft/__tests__/context.test.ts`

**Interfaces:**
- Produces `SessionDraftSeedV1 = { schemaVersion: 1; session: { name: '' }; drills: [] }` and `createSessionDraftSeed(): SessionDraftSeedV1`; seed is shape-valid but incomplete and never persisted.
- Produces `SessionDraftV1` per the spec, including optional `intensity?: 'v1' | 'v2' | 'v3' | 'v4'`, `interval?: string`, and `equipment?: EquipmentId[]`, with `EquipmentId = 'fins' | 'paddles' | 'pullbuoy' | 'snorkel'`.
- `SessionDraftContext = { poolLength: number; distanceUnits: string; groupNames: string[]; equipmentOptions: EquipmentId[]; recentSessions: Array<{ totalDistance: number; drills: Array<{ distance: number; stroke: Stroke; repeatCount: number }> }> }`.
- Produces `HarnessResult = { outcome: 'draft'; draft: SessionDraftV1 } | { outcome: 'not_actionable'; message: string }`, `ValidationResult<T> = { ok: true; value: T } | { ok: false; error: DraftValidationError }`, and `DraftValidationError = { code: 'invalid_shape' | 'unsupported_version' | 'limit_exceeded'; message: string }`.
- `SanitizedPrompt` is `{ text: string; removedCategories: Array<'known_name' | 'email' | 'phone'> }`. `SessionDraftRequest` is `{ prompt: string; seed: SessionDraftSeedV1; context: SessionDraftContext }`; neither type contains raw removed spans or swimmer names.
- `ContextInput` contains pool length, distance units, local group names, local known swimmer names for redaction, allowed equipment IDs, and recent session shapes; `RecentSessionShape` contains `totalDistance` and `{ distance, stroke, repeatCount }` drill summaries.
- Produces `validateSessionDraft(input: unknown): ValidationResult<SessionDraftV1>` and `validateHarnessResult(input: unknown): ValidationResult<HarnessResult>`.
- Produces `sanitizePrompt(text: string, knownNames: string[]): SanitizedPrompt`, with sanitized text and removal categories (never raw matched values in logs or network payloads).
- Produces `buildSessionDraftContext(input: ContextInput): SessionDraftContext`, limited to pool length, distance units, sanitized group names, current equipment options, and at most two recent-session structural summaries.

- [ ] **Step 1: Write failing validator tests** for a valid v1 draft; zero drills/items; blank names; non-integer/zero/negative distance and repeats; invalid stroke; intensity outside v1–v4; invalid equipment ID; over-limit text/counts; unsupported schema version; and unexpected model-output fields being rejected.
- [ ] **Step 2: Run `cd client && npm test -- --run src/services/sessionDraft/__tests__/validate.test.ts`** and confirm the new tests fail.
- [ ] **Step 3: Implement the contract and validator** in `schema.ts`/`validate.ts` using `unknown` narrowing, strict v1 field allowlists, and explicit size constants: prompt 4,000 characters, session/drill names 100 characters, interval 40 characters, at most 30 drills and 10 items per drill.
- [ ] **Step 4: Write seed tests** asserting the seed has `schemaVersion: 1`, empty session name, empty drills, and is not accepted as a final draft.
- [ ] **Step 5: Run the seed tests** and confirm they fail.
- [ ] **Step 6: Implement `createSessionDraftSeed()`** in `seed.ts`; keep the seed in memory/request only, never persist it.
- [ ] **Step 7: Write failing sanitizer tests** for exact case-insensitive known-swimmer-name matches, email and phone patterns, unchanged safe text, removal notice, and an all-removed/empty result.
- [ ] **Step 8: Run the sanitizer tests** and confirm they fail.
- [ ] **Step 9: Implement `sanitizePrompt`** with local-only matching. Do not send the known-name list or raw removed spans to the Edge Function.
- [ ] **Step 10: Write failing context tests** asserting context contains only approved settings/group names/equipment IDs/two structural summaries and excludes swimmer names, session/drill names, notes, IDs, labels, and counts.
- [ ] **Step 11: Run the context tests** and confirm they fail.
- [ ] **Step 12: Implement `buildSessionDraftContext`** and pass every free-text context value through the sanitizer; summaries contain only numeric distance/repeat patterns and `Stroke` values.
- [ ] **Step 13: Run `cd client && npm test -- --run src/services/sessionDraft/__tests__`** and confirm all four suites pass.
- [ ] **Step 14: Commit** as `feat(ai): add session draft contract and sanitizer`.

---

### Task 3: Atomic draft persistence and direct API path

**Files:**
- Modify: `client/src/db/schema.ts`
- Modify: `client/src/db/dao.ts`
- Modify: `client/src/api/sessions.ts`
- Create: `client/src/api/__tests__/sessions.test.ts`
- Create: `client/src/services/sessionDraft/apply.ts`
- Create: `client/src/services/sessionDraft/__tests__/apply.test.ts`
- Modify: `client/src/sync/__tests__/SupabaseSyncTransport.test.ts`

**Interfaces:**
- `Session.aiDraftStatus?: 'unreviewed'` is local-only; Dexie remains at version 8.
- DAO produces `addSessionWithDrills(session: SafeSession, drills: Omit<SafeDrill, 'sessionId'>[]): Promise<string>`, which creates IDs/timestamps and inserts the parent and children in one `db.transaction('rw', [db.sessions, db.drills], ...)`.
- DAO writer inserts drill rows directly; it must not call `addDrill()` or mutate `libraryDrills`.
- Service produces `applySessionDraft(input: unknown, options: { markUnreviewed: boolean }): Promise<ApplyDraftResult>`, `keepSessionDraft(id: string): Promise<void>`, and `getUnreviewedSessionDraft(): Promise<Session | undefined>`.
- `ApplyDraftResult = { outcome: 'created'; sessionId: string } | { outcome: 'existing_draft'; sessionId: string } | { outcome: 'invalid'; error: DraftValidationError }`. Storage errors reject; Dexie transaction rollback leaves no partial records.
- API produces `createSessionFromDraft(input: unknown): Promise<ApplyDraftResult>` for direct callers; existing `createSession(SafeSession): Promise<string>` remains unchanged.

- [ ] **Step 1: Write failing service tests** for map/default values and derived distance `sum(item.distance * item.repeatCount) * drill.repeatCount`, distance-weighted dominant stroke, generated IDs, intensity, interval, equipment preservation, and the `unreviewed` marker only when requested.
- [ ] **Step 2: Add failure-path tests** proving a Dexie failure rolls back session and drills, no generated drill appears in `libraryDrills`, all supported item fields survive mapping, no `segments` or other invisible fields are persisted, and simultaneous apply calls create at most one unreviewed draft and return the existing-draft result for the other caller.
- [ ] **Step 3: Add a sync transport test** proving `aiDraftStatus` is absent from cloud rows and remains local after round-trip mapping.
- [ ] **Step 4: Add a direct API test** proving `createSessionFromDraft` routes to the draft service without invoking the harness and defaults to a normal (unmarked) session.
- [ ] **Step 5: Run the apply/sync/API tests and confirm the new assertions fail.**
- [ ] **Step 6: Add the optional Session field and DAO transaction**. Keep v8 indexes/version unchanged. Keep CRUD construction in DAO; no draft validation or replacement decisions there.
- [ ] **Step 7: Implement the service** to validate at runtime, serialize slot check-and-create across same-origin tabs with the Web Locks API, return the existing-draft result if occupied, map draft items, call the atomic DAO writer, and provide explicit Keep behavior. If Web Locks are unavailable, fail clearly rather than risk creating two local drafts.
- [ ] **Step 8: Implement the direct draft API** through the same service, without invoking the harness. Keep existing session and drill APIs operational.
- [ ] **Step 9: Run `cd client && npm test -- --run src/services/sessionDraft/__tests__/apply.test.ts src/sync/__tests__/SupabaseSyncTransport.test.ts src/api/__tests__/sessions.test.ts`** and confirm all tests pass.
- [ ] **Step 10: Commit** as `feat(ai): persist session drafts atomically`.

---

### Task 4: Supabase Edge Function

**Files:**
- Create: `supabase/functions/ai-session-harness/index.ts`
- Create: `supabase/functions/ai-session-harness/handler.ts`
- Create: `supabase/functions/ai-session-harness/prompt.ts`
- Create: `supabase/functions/ai-session-harness/provider.ts`
- Create: `supabase/functions/ai-session-harness/output.ts`
- Create: `supabase/functions/ai-session-harness/index_test.ts`

**Interfaces:**
- `HarnessProvider.generate(input: ProviderInput): Promise<unknown>`; `HandlerDependencies` injects `authenticate(Request): Promise<{ userId: string; isAnonymous: boolean } | null>`, `consumeRateLimit(userId: string, limit: number, windowSeconds: number): Promise<RateLimitResult>`, `provider`, and the v1 prompt builder.
- `ProviderInput = { prompt: string; seed: SessionDraftSeedV1; context: SessionDraftContext; promptVersion: 'v1' }`; `RateLimitResult = { allowed: boolean; retryAfterSeconds: number }`.
- The Edge Function's RPC adapter maps `retry_after_seconds` to `retryAfterSeconds` and unwraps the returned JSON object before exposing `RateLimitResult` to the handler.
- Produces injectable `handleAiSessionHarness(request: Request, deps: HandlerDependencies): Promise<Response>`; it returns the discriminated `HarnessResult` or a typed HTTP error and never persists session data.
- Reads `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `AI_RATE_LIMIT_MAX` (default `10`), and `AI_RATE_LIMIT_WINDOW_SECONDS` (default `3600`) only from Edge Function secrets/environment.
- Uses one OpenAI-compatible chat-completions JSON-response adapter, with no client provider selector or added SDK dependency.
- Rejects request bodies over 32 KiB and aborts the provider request after 30 seconds.

- [ ] **Step 1: Write Deno handler tests with fake auth, limiter, and provider** for missing/invalid JWT, Supabase anonymous-auth identity, non-anonymous user success, invalid body, body too large, CORS preflight, rate-limit rejection before provider call, seed/context passed into the prompt, provider error/timeout, invalid provider output, and both response outcomes.
- [ ] **Step 2: Run `deno test supabase/functions/ai-session-harness/index_test.ts`** and confirm the new handler tests fail.
- [ ] **Step 3: Implement the injectable handler and prompt**. Verify the user via Supabase Auth, explicitly reject `user.is_anonymous`, derive limiter subject only from that verified user, and provide the sanitized coach request, blank seed, equipment options, and supported item schema to the model. Require a complete object, default unspecified stroke to freestyle and repeats to 1, map easy/medium/strong/hard to v1/v2/v3/v4, and omit optional details not stated or clearly implied.
- [ ] **Step 4: Implement the provider adapter** using one structured JSON response call and a bounded timeout. Do not log prompts, user context, provider response bodies, or secrets.
- [ ] **Step 5: Implement the atomic rate-limit RPC call** using the service-role client; reject over-limit calls with HTTP 429 and `Retry-After` before contacting the provider.
- [ ] **Step 6: Implement the Deno entry point** with the existing global `verify_jwt = true` configuration and explicit HTTP error mapping; keep the client validator authoritative.
- [ ] **Step 7: Run `deno test supabase/functions/ai-session-harness/index_test.ts`** and confirm all tests pass without provider secrets or network.
- [ ] **Step 8: Commit** as `feat(ai): add authenticated session harness function`.

---

### Task 5: Client invocation, prompt UI, and draft review

**Files:**
- Create: `client/src/api/sessionDraft.ts`
- Create: `client/src/pages/AiSessionDraft.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/SessionsList.tsx`
- Modify: `client/src/components/SessionCard.tsx`
- Modify: `client/src/pages/SessionDetail.tsx`
- Modify: `client/src/pages/Privacy.tsx`
- Modify: `docs/context/UI-Context.md`
- Modify: `docs/context/Sessions-Drills-Context.md`

**Interfaces:**
- API produces `prepareSessionDraft(prompt: string): Promise<PreparedSessionDraft>` using the seed, local settings, swimmer/group data, recent structural summaries, equipment options, and the sanitizer; and `requestSessionDraft(prepared: PreparedSessionDraft): Promise<HarnessResult>` using `supabase.functions.invoke('ai-session-harness', ...)`. The prepared value retains known swimmer names locally for response checks, but serializes only the sanitized prompt, seed, and `SessionDraftContext`.
- `PreparedSessionDraft = { prompt: string; seed: SessionDraftSeedV1; context: SessionDraftContext; removedCategories: SanitizedPrompt['removedCategories']; knownSwimmerNames: string[] }`; `knownSwimmerNames` is client-only and must not be serialized.
- `requestSessionDraft` runtime-validates the result and rejects any returned user-visible text matching a local swimmer name, including a non-actionable message.
- Route is `/sessions/ai`; register the static route before `/sessions/:id`.
- Prompt page consumes `useAuth()` and calls API preparation/request/apply functions; it does not import DAO or Dexie.

- [ ] **Step 1: Add unit tests in `client/src/api/__tests__/sessionDraft.test.ts`** with a mocked Supabase client: sends sanitized request, seed, and allow-listed context only; maps 401/429/5xx/offline errors; refuses an empty sanitized prompt before invoking Supabase; distinguishes invalid from non-actionable payloads; blocks output containing a known swimmer name.
- [ ] **Step 2: Run the API tests** and confirm they fail.
- [ ] **Step 3: Implement `api/sessionDraft.ts`** as the only client network boundary. Use the signed-in session and return typed outcome/error values; do not put fetch/auth logic in pages.
- [ ] **Step 4: Add `/sessions/ai` and the Sessions-list entry.** For missing user or `user.is_anonymous`, show the sign-in-required state and a Settings link without making a request.
- [ ] **Step 5: Implement prompt preparation and review.** Sanitize locally, replace the editable field with sanitized text, announce removed categories (not values), show the warning against names/health details, and do not send if the resulting prompt is empty.
- [ ] **Step 6: Implement request/loading/error states.** Preserve coach-editable sanitized input after recoverable failures. Distinguish auth, offline, 429/retry time, validation, timeout, and provider errors.
- [ ] **Step 7: On actionable success, validate and apply atomically** with `markUnreviewed: true`, then navigate to `/sessions/:id`; non-actionable success creates nothing and gives a concise next-step prompt.
- [ ] **Step 8: Update Sessions list/editor lifecycle.** Show the local draft marker and discard action; Keep session clears only the marker; ordinary edits retain it; discard confirms and uses existing delete safeguards; a second request offers Open draft or Discard and start over.
- [ ] **Step 9: Update `Privacy.tsx`** to disclose the selected provider, the sanitized coach text and structural context sent when using AI drafting, sign-in requirement, and the warning not to enter swimmer-identifying or health information. Update the policy date and avoid claiming automatic detection is complete.
- [ ] **Step 10: Run `cd client && npm run check`** and confirm lint, TypeScript, knip, and unit tests pass. Do not add a Playwright flow in this task.
- [ ] **Step 11: Commit** as `feat(ai): add session draft creation flow`.

---

### Task 6: Versioned live eval corpus and runner

**Files:**
- Create: `supabase/functions/ai-session-harness/evals/cases.ts`
- Create: `supabase/functions/ai-session-harness/evals/scorer.ts`
- Create: `supabase/functions/ai-session-harness/evals/scorer_test.ts`
- Create: `supabase/functions/ai-session-harness/evals/run.ts`
- Modify: `docs/context/Test-Context.md`

**Interfaces:**
- Each synthetic case has an ID, sanitized prompt, structural context, expected `outcome`, and explicit checkable constraints. Cases contain no real personal data.
- `EvalConstraint = { kind: 'total_distance'; expected: number } | { kind: 'contains_stroke'; stroke: Stroke } | { kind: 'drill_repeat_count'; drillIndex: number; expected: number } | { kind: 'item_intensity'; drillIndex: number; itemIndex: number; expected: 'v1' | 'v2' | 'v3' | 'v4' } | { kind: 'item_interval'; drillIndex: number; itemIndex: number; expected: string } | { kind: 'item_equipment'; drillIndex: number; itemIndex: number; expected: EquipmentId[] }`; `EvalScore = { passed: boolean; failures: string[] }`.
- Produces `scoreEvalCase(testCase: EvalCase, result: unknown): EvalScore`, with hard failures for wrong outcome, invalid draft, or violated explicit constraints.
- Runner calls the same versioned prompt and provider adapter as the Edge Function, validates each result, and reports prompt/schema/model versions, outcome, constraint scores, latency, and token/cost data when the provider returns it.

- [ ] **Step 1: Add synthetic actionable and non-actionable cases** covering explicit volume, repeats, mixed strokes, v1–v4 intensity, interval wording, each supported equipment ID, a third-repeat-only equipment change, vague requests, non-swim requests, and requests for swimmer names.
- [ ] **Step 2: Write deterministic eval scoring tests** for schema acceptance, non-actionable rejection, exact user-specified distances/repeats/strokes/intensity/equipment, and rejection of unsupported hidden fields; avoid exact-output snapshots.
- [ ] **Step 3: Run the scorer tests** and confirm they fail.
- [ ] **Step 4: Implement `scoreEvalCase` and its report format.**
- [ ] **Step 5: Run the scorer tests** and confirm they pass.
- [ ] **Step 6: Implement the opt-in Deno runner** to use environment secrets, the real prompt/provider adapter, synthetic inputs only, and no database writes. Fail the run on invalid schema or failed hard constraints; emit usefulness rubric results for coach review.
- [ ] **Step 7: Add the exact opt-in command and secret requirements** to `Test-Context.md`. Keep the runner outside `npm run check` and normal CI.
- [ ] **Step 8: Run deterministic eval tests without network/provider secrets** and verify the live runner refuses to start with missing configuration.
- [ ] **Step 9: Commit** as `test(ai): add session harness eval corpus`.

---

### Task 7: Context updates and release verification

**Files:**
- Modify: `docs/context/App-Context.md`
- Modify: `docs/context/DB-Context.md`
- Modify: `docs/context/UI-Context.md`
- Modify: `docs/context/Sessions-Drills-Context.md`
- Modify: `docs/context/Test-Context.md`
- Modify: `docs/context/App-Tasks-Context.md`

- [ ] **Step 1: Document the Edge Function boundary/provider secret setup** in `App-Context.md`; document the route/lifecycle in `UI-Context.md` and v1 step fields, intensity mapping, equipment-split semantics, and deferred segments in `Sessions-Drills-Context.md`.
- [ ] **Step 2: Document the local-only marker, unchanged Dexie v8, private rate-limit store, migration order, and no-library-write invariant** in `DB-Context.md`.
- [ ] **Step 3: Document fake-provider/security test commands, live eval opt-in, and the deferred Playwright TODO** in `Test-Context.md`.
- [ ] **Step 4: Mark the feature tasks complete** in `App-Tasks-Context.md` without marking deferred Playwright work complete.
- [ ] **Step 5: Run final checks.**

```bash
(cd client && npm run check)
deno test supabase/functions/ai-session-harness/index_test.ts
deno test supabase/functions/ai-session-harness/evals
```

Expected: all commands exit 0. Do not run or claim Playwright coverage for this feature; its TODO remains deferred by design.

- [ ] **Step 6: Manually smoke-test with a non-anonymous signed-in user** against local Supabase and a configured provider: actionable request → complete editable draft including intensity/equipment → Keep; equipment only on the final repeat → Discard; non-actionable request → no persisted rows; anonymous user and rate-limited user → no provider call.
- [ ] **Step 7: Commit** as `docs: update AI session harness context`.

---

## Deployment Gates

1. The new private rate-limit migration is locally tested and applied to hosted Supabase before merging/deploying the Edge Function or client caller.
2. Supabase secrets for the provider URL/key/model and rate-limit values are set before enabling the feature. The API key remains server-side only.
3. `./supabase/tests/verify-hosted.sh` passes after migration deployment.
4. Privacy disclosure is updated for the selected provider before release.
5. Live eval suite is run and reviewed when changing prompt, provider/model, or `SessionDraftV1`; Playwright stays deferred until its infrastructure is corrected.
