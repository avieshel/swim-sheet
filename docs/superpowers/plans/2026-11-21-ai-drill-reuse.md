# AI Drill Reuse & Coach Building Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI session generation automatically reuse coach-ranked library drills as building blocks, and make manual session-drill edits silently converge to existing library drills on high-confidence matches.

**Architecture:** Extend the shared `sessionDraft` contract with bounded, opaque library candidates in context and an optional `sourceCandidateId` on draft drills. The client selects ranked candidates, the model may reference one, and the client resolves it to a trusted `libraryDrillId` on apply while keeping distance/variant fields local to the session drill copy. Manual drill saves reuse the same high-confidence matching/linking primitives with no blocking prompt on high-confidence matches.

**Tech Stack:** TypeScript, React 19, Vite/Vitest, Dexie 4, shared `sessionDraft` contract consumed by PWA and Deno Edge Function, Supabase Edge Function (`ai-session-harness`), Playwright for e2e where needed.

**Spec:** User conversation in this session (2026-11-21) + `docs/context/Drill-Model-Context.md`, `docs/context/Drill-Identity-Context.md`, `docs/context/Session-Model-Context.md`, `docs/context/DB-Schema-Context.md`.

## Global Constraints

- All tunable limits/bounds live in config, never inlined: shared contract bounds in `shared/sessionDraft/config.ts`; SQL bounds as named constants in migrations. No naked numeric literals in those roles.
- Shared `sessionDraft` contract is the single source of truth; PWA and Deno Edge Function both consume it. No parallel copy/forked validator.
- Never trust model-supplied DB IDs. Model may only echo opaque request-scoped `candidateId` values sent in context; client resolves to real `libraryDrillId`.
- AI apply must not silently create noisy library duplicates. Unmatched low-confidence drills stay unlinked session copies unless explicitly created as library blocks by user action.
- High-confidence manual match auto-link must not bother the user with a blocking prompt. Medium/low confidence must not silently rewrite intent.
- Keep copy-on-use: session drills remain session-owned copies; `libraryDrillId` is provenance/rank link.
- `npm run check` must pass (lint + typecheck + unit tests). Relevant e2e tests must pass if touched.
- No AI-assistant attribution in commit messages.

## Review Focus

- **Hallucinated `sourceCandidateId`**: model returns a candidate ID not present in request; validator/apply must reject or ignore safely, never resolve to an arbitrary DB row.
- **Wrong auto-link on manual edit**: a distance/name-similar but semantically different drill gets silently linked; high-confidence threshold must be conservative and distance-only differences must be treated carefully.
- **Library pollution / duplicate convergence failure**: AI apply or manual save creates new library drills for near-duplicates, defeating ranking. No-match path must not upsert by fuzzy name.
- **Shared-contract drift**: PWA and Deno use different shapes/limits; shared types/validators/schema/prompt/tests must move together.
- **Prompt-size/context leakage**: candidates include too much text or PII-like free text; candidate payload must be bounded and structural, and never include swimmer names/IDs.

---

## File Structure

- `shared/sessionDraft/types.ts` — add candidate/context/output provenance types.
- `shared/sessionDraft/config.ts` — add candidate/ranking-related limits.
- `shared/sessionDraft/validate.ts` — validate candidates and `sourceCandidateId`.
- `shared/sessionDraft/schema.ts` — expose `libraryCandidates` and `sourceCandidateId` in model-facing JSON schema.
- `shared/sessionDraft/format.ts` — keep formatting/validation feedback coherent if needed.
- `supabase/functions/ai-session-harness/agent/prompt.ts` — instruct model to reuse candidates and pick granularity.
- `supabase/functions/ai-session-harness/agent/prompt_test.ts` — prompt/contract expectations.
- `client/src/services/sessionDraft/context.ts` — include bounded candidates in context.
- `client/src/api/sessionDraft.ts` — build ranked candidates, request-local candidate map, pass through request/apply.
- `client/src/services/sessionDraft/apply.ts` — resolve `sourceCandidateId` to `libraryDrillId`, apply variant, bump rank.
- `client/src/db/dexieDao.ts` / `client/src/db/dao.ts` — support setting `libraryDrillId` on draft-created drills and rank bump/use recording; keep library pollution guard.
- `client/src/services/drillService.ts` / `client/src/services/libraryRefService.ts` — reuse/rank helpers.
- `client/src/utils/drillHelpers.ts` — high-confidence library match helper for manual convergence.
- `client/src/pages/SessionDetail.tsx` (and/or drill save path) — silent high-confidence auto-link on manual save.
- Tests beside affected modules in `__tests__/`.

---

### Task 1: Shared draft contract for library candidates and provenance

**Files:**
- Modify: `shared/sessionDraft/types.ts`
- Modify: `shared/sessionDraft/config.ts`
- Modify: `shared/sessionDraft/validate.ts`
- Modify: `shared/sessionDraft/schema.ts`
- Test: `client/src/services/sessionDraft/__tests__/sharedValidate.test.ts`
- Test: `client/src/services/sessionDraft/__tests__/schema.test.ts`
- Test: `client/src/services/sessionDraft/__tests__/context.test.ts` (if shape affected)

**Interfaces:**
- Produces: `SessionDraftLibraryCandidateV1`, optional `SessionDraftContext.libraryCandidates`, optional `SessionDraftDrillV1.sourceCandidateId`.
- Produces: config limits `maxLibraryCandidates`, `maxCandidateItems`, `maxCandidateIdLength` (names TBD, exact in config).
- Consumes: existing `SessionDraftItemV1`, `EquipmentId`, `Stroke`, `IntensityV1`.

- [ ] **Step 1: Write failing validation tests**

Add tests in `client/src/services/sessionDraft/__tests__/sharedValidate.test.ts`:
```ts
it('accepts a draft drill with sourceCandidateId present in request candidates', () => { /* request with libraryCandidates + draft.sourceCandidateId */ })
it('rejects draft drill sourceCandidateId not present in candidates', () => { /* invalid_request or invalid_shape as chosen */ })
it('rejects request with too many libraryCandidates', () => { /* limit_exceeded */ })
it('rejects libraryCandidate with unsupported fields', () => { /* invalid_shape */ })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/services/sessionDraft/__tests__/sharedValidate.test.ts`
Expected: FAIL because fields/types/validation do not exist.

- [ ] **Step 3: Implement minimal contract/types/config**

In `shared/sessionDraft/types.ts`, add:
```ts
export interface SessionDraftLibraryCandidateV1 {
  candidateId: string
  name: string
  description?: string
  stroke: Stroke
  distance: number
  repeatCount: number
  items: SessionDraftItemV1[]
  focus?: 'technique' | 'fitness' | 'none'
  labels?: string[]
}
```
Add `libraryCandidates?: SessionDraftLibraryCandidateV1[]` to `SessionDraftContext`. Add `sourceCandidateId?: string` to `SessionDraftDrillV1`.

In `shared/sessionDraft/config.ts`, add limits, e.g.:
```ts
maxLibraryCandidates: 12,
maxCandidateIdLength: 64,
maxCandidateLabels: 8,
```
(reuse existing item/name/description/label limits where possible).

- [ ] **Step 4: Implement validation**

In `shared/sessionDraft/validate.ts`:
- allow `libraryCandidates` in request context `hasOnlyKeys`.
- validate each candidate object/fields/bounds; require unique `candidateId`.
- allow `sourceCandidateId` on draft drills and harness-validated drafts.
- validate `sourceCandidateId` is a string within max length; actual membership in request candidates is validated at request boundary (request validator) and/or apply resolution. Prefer request validator: when validating request, also validate seed? No, draft is output. For output validation (`validateSessionDraft/validateHarnessResult`), accept optional string shape; for client apply, resolve against known map. For request context, validate candidates. Keep rule clear and documented.

- [ ] **Step 5: Update JSON schema**

In `shared/sessionDraft/schema.ts`, add `libraryCandidates` to context-derived schema if context is represented; add `sourceCandidateId` to drill schema. Ensure descriptions guide the model to echo only provided candidate IDs.

- [ ] **Step 6: Run tests to verify pass**

Run: `cd client && npx vitest run src/services/sessionDraft/__tests__/sharedValidate.test.ts src/services/sessionDraft/__tests__/schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shared/sessionDraft client/src/services/sessionDraft/__tests__/sharedValidate.test.ts client/src/services/sessionDraft/__tests__/schema.test.ts
git commit -m "feat(session-draft): add library candidate contract"
```

### Task 2: Prompt and harness include candidate reuse rules

**Files:**
- Modify: `supabase/functions/ai-session-harness/agent/prompt.ts`
- Test: `supabase/functions/ai-session-harness/agent/prompt_test.ts`
- Modify if needed: `supabase/functions/ai-session-harness/harness/request_test.ts`

**Interfaces:**
- Consumes: `SessionDraftContext.libraryCandidates`.
- Produces: prompt instructions that prefer candidate reuse and set `sourceCandidateId`.

- [ ] **Step 1: Write failing prompt tests**

Add tests asserting prompt includes:
- a library candidates section when candidates exist;
- rule “reuse by sourceCandidateId when a candidate matches intent”;
- rule “never invent near-duplicate name for same building block / use variant fields”;
- granularity guidance for “4 separate 100m drills” vs “4× Broken 100m”.

- [ ] **Step 2: Run Deno tests to verify fail**

Run: `cd supabase/functions/ai-session-harness && deno task test`
Expected: FAIL on new prompt assertions.

- [ ] **Step 3: Implement prompt changes**

In `buildSystemPrompt()`, render bounded candidate list (compact, structural). Add rules:
- prefer known coach building block when intent matches;
- set `sourceCandidateId` to provided candidate ID;
- adjust distance/repeat/items/interval/intensity as variant;
- if no candidate fits, omit `sourceCandidateId`;
- never emit DB IDs; only provided candidate IDs.

- [ ] **Step 4: Run Deno tests to verify pass**

Run: `cd supabase/functions/ai-session-harness && deno task test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ai-session-harness/agent/prompt.ts supabase/functions/ai-session-harness/agent/prompt_test.ts
git commit -m "feat(ai-harness): prompt for library drill reuse"
```

### Task 3: Client builds ranked library candidates

**Files:**
- Modify: `client/src/services/sessionDraft/context.ts`
- Modify: `client/src/api/sessionDraft.ts`
- Modify: `client/src/services/sessionDraft/__tests__/context.test.ts`
- Modify: `client/src/api/__tests__/sessionDraft.test.ts`
- Modify: `client/src/db/dexieDao.ts` or `client/src/services/drillService.ts` (read/rank helper)

**Interfaces:**
- Produces: `PreparedSessionDraft.libraryDrillMap: Record<string, string>` (candidateId -> libraryDrillId), not sent to harness.
- Produces: `SessionDraftContext.libraryCandidates` sent to harness.
- Consumes: local library drills, ranking fields (`popularity` initially).

- [ ] **Step 1: Write failing tests**

Context test: `buildSessionDraftContext` includes bounded `libraryCandidates` and allow-listed keys include it when present.
API test: `prepareSessionDraft` builds candidates from ranked library drills, assigns opaque candidate IDs, excludes DB IDs from request context.

- [ ] **Step 2: Run tests to verify fail**

Run: `cd client && npx vitest run src/services/sessionDraft/__tests__/context.test.ts src/api/__tests__/sessionDraft.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement candidate ranking/selection**

Add helper to select top N library drills:
- source: `getAllLibraryDrills()` or `getPopularDrills()` + recency fallback.
- rank by `popularity ?? 0`, then `updatedAt` desc, then stable name.
- map to compact candidate DTO; generate opaque IDs (`cand_1...`) per request.
- cap by `defaultSessionDraftConfig.limits.maxLibraryCandidates`.

- [ ] **Step 4: Wire into prepare/request/apply call data**

`PreparedSessionDraft` keeps `libraryDrillMap` client-side. Request body still validates; `libraryDrillMap` must not be sent. Preserve privacy: candidates are structural coach-authored drill data already local; no swimmer data.

- [ ] **Step 5: Run tests to verify pass**

Run: `cd client && npx vitest run src/services/sessionDraft/__tests__/context.test.ts src/api/__tests__/sessionDraft.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/services/sessionDraft/context.ts client/src/api/sessionDraft.ts client/src/services/sessionDraft/__tests__/context.test.ts client/src/api/__tests__/sessionDraft.test.ts client/src/db/dexieDao.ts client/src/services/drillService.ts
git commit -m "feat(session-draft): send ranked library candidates"
```

### Task 4: Apply resolves candidate provenance and records rank

**Files:**
- Modify: `client/src/services/sessionDraft/apply.ts`
- Modify: `client/src/db/dexieDao.ts` (if `addSessionWithDrills` needs libraryDrillId support)
- Modify: `client/src/api/sessionDraft.ts` (pass map to apply)
- Test: `client/src/services/sessionDraft/__tests__/apply.test.ts`

**Interfaces:**
- Changes: `applySessionDraft(input, options?: { libraryDrillMap?: Record<string, string> })` or equivalent.
- Produces: session drill rows with `libraryDrillId` when resolved.
- Produces: rank bump for reused library drills.

- [ ] **Step 1: Write failing apply tests**

```ts
it('links a draft drill to libraryDrillId when sourceCandidateId resolves', async () => { ... })
it('keeps variant distance/items while linking same libraryDrillId', async () => { ... })
it('ignores unknown sourceCandidateId and leaves drill unlinked', async () => { ... })
it('bumps popularity for reused library drills', async () => { ... })
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cd client && npx vitest run src/services/sessionDraft/__tests__/apply.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement apply resolution**

- Extend mapping to carry `libraryDrillId` when `drill.sourceCandidateId` resolves through provided map.
- Do not mutate library drill; session drill keeps variant fields.
- Extend `addSessionWithDrills`/transaction to persist `libraryDrillId` on created drills.
- After create, bump popularity for unique resolved IDs (best-effort; failure should not lose session? prefer in same flow or post-create with clear behavior; keep simple and safe).

- [ ] **Step 4: Run tests to verify pass**

Run: `cd client && npx vitest run src/services/sessionDraft/__tests__/apply.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/services/sessionDraft/apply.ts client/src/db/dexieDao.ts client/src/api/sessionDraft.ts client/src/services/sessionDraft/__tests__/apply.test.ts
git commit -m "feat(session-draft): resolve reused library drills on apply"
```

### Task 5: Manual high-confidence auto-link on drill save

**Files:**
- Modify: `client/src/utils/drillHelpers.ts`
- Modify: `client/src/pages/SessionDetail.tsx`
- Modify: `client/src/components/DrillEditorModal.tsx` only if needed
- Test: `client/src/utils/__tests__/drillHelpers.test.ts`
- Test: `client/src/pages/__tests__/SessionDetail.test.tsx` or nearest existing test

**Interfaces:**
- Produces: `findHighConfidenceLibraryMatch(...)` or confidence-aware match result.
- Consumes: library drills and edited drill draft.

- [ ] **Step 1: Write failing tests**

Add tests for match helper:
```ts
it('returns high confidence for normalized same-name distance variant', ...)
it('returns no auto-link for medium/low confidence similar names', ...)
```
Add SessionDetail save-path test: high-confidence match auto-links `libraryDrillId` and does not open blocking similar warning.

- [ ] **Step 2: Run tests to verify fail**

Run: `cd client && npx vitest run src/utils/__tests__/drillHelpers.test.ts src/pages/__tests__/SessionDetail.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement conservative auto-link**

- Define high-confidence as normalized exact name match, or existing strong match with distance-only variant and same stroke/structure signal; be conservative.
- In SessionDetail save, if high-confidence library match found, set `libraryDrillId` on saved drill and skip blocking similar warning. Optional subtle toast is acceptable only if non-blocking; no modal.
- Do not auto-create library drill on fuzzy match. Keep existing create flow; ensure `addDrill`/update path results in convergence.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd client && npx vitest run src/utils/__tests__/drillHelpers.test.ts src/pages/__tests__/SessionDetail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/drillHelpers.ts client/src/pages/SessionDetail.tsx client/src/components/DrillEditorModal.tsx client/src/utils/__tests__/drillHelpers.test.ts client/src/pages/__tests__/SessionDetail.test.tsx
git commit -m "feat(drills): auto-link high-confidence library matches"
```

### Task 6: Verification and docs

**Files:**
- Modify: `docs/context/Drill-Model-Context.md` (if contract behavior changes)
- Modify: `docs/context/DB-Context.md` or `docs/context/DB-Schema-Context.md` only if schema persisted fields change
- Modify: `docs/context/App-Context.md` if architecture notes need update

- [ ] **Step 1: Run focused tests**

Run:
```bash
cd client && npx vitest run src/services/sessionDraft src/api/__tests__/sessionDraft.test.ts src/utils/__tests__/drillHelpers.test.ts src/pages/__tests__/SessionDetail.test.tsx
cd supabase/functions/ai-session-harness && deno task test
```
Expected: PASS.

- [ ] **Step 2: Run full project checks**

Run:
```bash
cd client && npm run check
```
Expected: PASS.

- [ ] **Step 3: Update context docs**

Document: AI draft can receive ranked library candidates; model may return `sourceCandidateId`; client resolves to trusted `libraryDrillId`; manual high-confidence matches auto-link silently.

- [ ] **Step 4: Commit**

```bash
git add docs/context docs/superpowers/plans/2026-11-21-ai-drill-reuse.md
git commit -m "docs: document AI drill reuse flow"
```

### Task 7: PR readiness

- [ ] **Step 1: Review diff for accidental library pollution / trusted-ID leaks**

Check: no model DB ID accepted; no fuzzy auto-create; no PII added to candidates.

- [ ] **Step 2: Create PR**

Run:
```bash
gh pr create --fill
```
If `--fill` is insufficient, write a clear title/body summarizing Win 1 and Win 2, risks, and test coverage.

- [ ] **Step 3: Report verification evidence**

Include commands run and outcomes in final handoff.