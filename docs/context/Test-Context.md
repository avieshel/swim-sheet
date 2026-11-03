# SwimSheet Test Context

## Testing Stack

| Type | Tool | Location | Command |
|------|------|----------|---------|
| Unit / Integration | Vitest | `client/src/**/*.test.{ts,tsx}` (co-located) | `npm run test` (from `client/`) |
| Component | Vitest + React Testing Library | co-located `__tests__/*.test.tsx` | `npm run test` (from `client/`) |
| E2E | Playwright | `tests/` at project root | `npm run test:e2e` (from root) |
| Visual | Playwright `toHaveScreenshot` | `tests/visual/` | `npm run test:e2e` |

**Playwright runs from the project root, but `@playwright/test` is installed in
`client/node_modules`.** Node resolves a module relative to the file that imports
it, and `playwright.config.ts` sits at the root — so the config's own
`import { defineConfig } from '@playwright/test'` cannot resolve without a
`NODE_PATH` pointing at `client/node_modules`. The root `test:e2e` script sets it.
Do not "simplify" that script back to a bare `playwright test` — it will fail with
`MODULE_NOT_FOUND`, and `npx playwright` is worse: it silently downloads a
different Playwright version into the npx cache instead of using the pinned one.

Vite's dev server runs in `development` mode (`npm run dev` → `vite`), so it
reads `.env`, `.env.local`, `.env.development`, `.env.development.local` — and
**not** `.env.production.local`. Because `client/vite.config.ts` sets
`envDir: '..'`, env files must live at the project root. To serve hosted Supabase
values locally, start the dev server in production mode explicitly:
`cd client && npx vite --mode production`.

## Test Philosophy

1. **Unit tests** verify pure functions (utils, lap editing, format helpers) and service logic.
2. **Service tests** verify business operations against a real Dexie instance (in-memory IndexedDB via `fake-indexeddb` or similar).
3. **E2E tests** verify critical user flows against a running app (client dev server + mocked/real server).
4. **No snapshot testing** — assertions should be explicit about values.
5. **Two-tier UI testing**: React Testing Library (`@testing-library/react` + `user-event`,
   with `fake-indexeddb` for Dexie) covers components and form modals in isolation —
   rendering, a11y behavior, user interactions, edge cases. Playwright covers user
   flows across pages against the real dev server. Pick the cheapest tier that
   verifies the behavior; only escalate to Playwright when routing, multi-page, or
   boot-time behavior is involved.

---

## Unit Tests (`vitest`)

### Location
Test files are co-located with source files in `__tests__/` directories (75 files as of 2026-11):

| Directory | Count | Notable contents |
|-----------|-------|------------------|
| `client/src/api/__tests__/` | 11 | `auth`, `authStorage`, `drills`, `runs`, `sessions`, `sessionPackages`, `sessionDraft`, `supabaseStorage`, … |
| `client/src/components/__tests__/` | 14 (.tsx, RTL) | `SwimmerFormModal`, `DrillEditorModal`, `LaneEditorModal`, `SessionPackageImportModal`, `CustomSelect`, `Table`, `SwimmerRows`, … |
| `client/src/pages/__tests__/` | 4 (.tsx, RTL) | `Settings`, `AiSessionDraft`, `AuthCallback`, `SessionsListImportExport` |
| `client/src/context/__tests__/` | 2 | `AuthProvider` (RTL), `LiveSessionContext` |
| `client/src/db/__tests__/` | 5 | schema migrations (V7), backup, record migration, seed sessions |
| `client/src/services/__tests__/` | 12 | `drillService`, `runService`, `sessionService`, `swimmerService`, `sessionPackageService`, `runHistoryService`, … |
| `client/src/services/sessionDraft/__tests__/` | 8 | `validate`, `apply`, `sanitize`, `schema`, `distance`, `format`, `seed`, `context` |
| `client/src/services/sessionPackage/__tests__/` | 1 | `validate` |
| `client/src/sync/__tests__/` | 8 | `syncStore`, `syncService`, `accountIsolation`, `firstMerge`, `conflictResolution`, `SupabaseSyncTransport`, … |
| `client/src/timing/__tests__/` | 2 | `liveTiming`, `timestampStore` |
| `client/src/utils/` (+ `__tests__/`) | 6 | `lapEditing`, `drillHelpers`, `sessionProgress`, `sessionSnapshot`, `sessionPackageFile`, `routeMeta` |
| `client/src/__tests__/` | 2 | `config`, `i18n-coverage` |

### What to Unit Test
- Pure utility functions (lap editing, time formatting, stroke aggregation)
- Service methods with clear inputs/outputs
- Data transformations (cumulative ↔ split conversion)
- React components and form modals — render, interact with `user-event`, assert
  visible output. Seed Dexie in-memory via `fake-indexeddb`.

### What NOT to Unit Test
- Dexie/IndexedDB internals (covered indirectly by service tests on the real schema)
- Express route handlers (server currently has no test suite)
- Full page flows / routing (use Playwright)

---

## E2E Tests (`playwright`)

### Location
- `tests/` at project root (Playwright config at `playwright.config.ts`)

### Current Test Files
14 specs in `tests/` + 1 visual spec in `tests/visual/`:

| File | What it tests |
|------|---------------|
| `auth-account.spec.ts` | Settings account UI: signed-in/out states, sign-out keeps local roster, OAuth callback without params, no account chrome on live deck |
| `drill-timer.spec.ts` | Smoke check: live deck page loads, timer reducer reachable via dynamic import |
| `landing.spec.ts` | `/about` landing page: SEO metadata, noindex rules, legal page content and headings, privacy claims |
| `layout-responsive.spec.ts` | Lane card controls/laps layout at 1/2/3/4 columns + mobile width |
| `live-deck.spec.ts` | Lane timer start, lap + stroke tracking per swimmer, touch-target and drill-completion visual checks |
| `live-dot.spec.ts` | Nav dot + template badge appear while a run is active, disappear on completion |
| `live-swimmer-promotion.spec.ts` | Quick swimmer promoted to real roster swimmer; lane Add Swimmer vs Temp Swimmer paths |
| `livedeck-ui-validation.spec.ts` | UI/UX contract: ≥44px touch targets, no horizontal overflow at mobile/tablet, timer sizing, theme-aware borders, WCAG contrast dark+light |
| `persistence.spec.ts` | Drill auto-save to LaneDrillResult when all swimmers complete a drill |
| `PoolLengthSelect.spec.ts` | Pool length selector behavior on live deck |
| `session-authoring-ui.spec.ts` | Session template authoring: editor sections, drill controls, modal focus restore (Escape, drill bank, metadata dialog), narrow light/dark screens, AI compose |
| `session-import-export.spec.ts` | Exported session file imports into another signed-out PWA as an independent copy |
| `swimmers-crud.spec.ts` | Swimmers page create / edit / delete |
| `sync-cross-device.spec.ts` | Two-browser cross-device sync over real hosted Supabase (needs env vars — see below) |
| `visual/he-live-deck-rtl.spec.ts` | Hebrew RTL layout visual regression (`toHaveScreenshot`) |

`sync-cross-device.spec.ts` requires a real reachable Supabase project:
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` plus `VITE_AUTH_TEST_EMAIL` /
`VITE_AUTH_TEST_PASSWORD`, and the sync foundation migration applied. It is not
part of a default local run.

### E2E Test Guidelines
1. **Seed data via `page.evaluate`** using `(window as any).db` — must wait for Dexie to be open first:
   ```typescript
   await page.waitForFunction(() => (window as any).db?.isOpen?.());
   ```
2. **Use descriptive test names** — format: `"<action> <what> <context>"`
3. **Each test is independent** — seed its own data in `beforeEach` or inline
4. **Test critical flows only** — not every edge case (those are unit tests)
5. **Verify visible UI state** — `expect(page.locator(...)).toBeVisible()`, not console/network state

### Test Setup Pattern
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).db?.isOpen?.());
  // seed data via page.evaluate ...
});
```

---

## Current Coverage

| Area | Test Level | Status |
|------|-----------|--------|
| Lap editing (add, remove, move, split conversion) | Unit | Covered |
| Drill service (CRUD, enrichment) | Unit | Covered |
| Run service (lifecycle) | Unit | Covered |
| Session service | Unit | Covered |
| Swimmer service | Unit | Covered |
| Sync engine (store, service, isolation, merge, conflicts, transport) | Unit | Covered (8 suites) |
| Session draft pipeline (validate, apply, sanitize, schema, …) | Unit | Covered (8 suites) |
| API layer (Dexie + HTTP wrappers) | Unit | Covered (11 suites) |
| DB schema migrations / backup / seed | Unit | Covered (5 suites) |
| Form modals & components (swimmer, drill, lane, import) | Unit (RTL) | Covered (14 suites) |
| Pages (Settings, AiSessionDraft, AuthCallback, import/export list) | Unit (RTL) | Covered (4 suites) |
| Landing page + legal/SEO content | E2E | Covered |
| Auth account & sign-out | E2E | Covered |
| Live deck — timer start | E2E | Covered |
| Live deck — UI/UX validation (targets, contrast, overflow) | E2E | Covered |
| Live deck — group split | E2E | Needed |
| Live deck — swimmer move between lanes | E2E | Needed |
| Live deck — swimmer promotion | E2E | Covered |
| Session template CRUD / authoring UI | E2E | Covered (`session-authoring-ui.spec.ts`) |
| Session import/export cross-device | E2E | Covered (`session-import-export.spec.ts`) |
| Cross-device sync | E2E | Covered (`sync-cross-device.spec.ts`, real Supabase + env) |
| Hebrew RTL live deck | Visual E2E | Covered (`tests/visual/`) |
| Responsive layout | E2E | Covered (flaky — Dexie timing) |
| Drill persistence | E2E | Covered (flaky — Dexie timing) |
| Settings page full flow | E2E | Not covered (page covered by RTL unit test; account flows by `auth-account.spec.ts`) |
| History/review | E2E | Not implemented yet |

## Known Flaky Tests
E2E tests that seed Dexie via `page.evaluate` may fail if Dexie hasn't finished opened. Mitigation:
- Always use `waitForFunction(() => (window as any).db?.isOpen?.())` before evaluate
- Retry logic within evaluate as fallback

`accountIsolation.test.ts` intermittently failed in CI (2026-10-28) — not a flake but a real
race: deferred capture captures (`deferCapture` in `syncStore.ts`) can materialize an
unclaimed `orgId: ''` meta row mid-sync, after `claimUnclaimed`; `getPendingChanges` then
treated it as claimable by the active (foreign) org, pushing local data cross-account, and
a stale-read full-row put could revert a claim to `''`. Fixed in 2026-10-28: `getPendingChanges(orgId, homeOrg)` only pushes unclaimed rows to the home org, and
`markDirty`/`markDirtyDelete` update a subset of fields first (full-row put only on first
creation) so a late capture can never rewrite a claim. Stress-run 15× clean.

## Playwright API Gotchas

The cross-device sync spec was written against a different test runner and had
never executed, so it used APIs that do not exist in Playwright. Check these
before trusting a spec that has not run recently:

| Looks like | Reality in Playwright |
|------------|-----------------------|
| `test.describe.skipIf(cond)` | **Vitest-only.** Use `test.skip(cond, reason)` inside the describe body |
| `test.context().browser()` | No such thing. Use the `browser` fixture in the test signature |
| `expect.poll(fn).resolves.toBe(x)` | `expect.poll` does not support `resolves`. Unwrap the promise in the callback |
| `res.count` on an update | Stays `null` without `Prefer: count=exact`. Use the returned row array length |
| `getByText(...)` on a route that doesn't render it | Assert against IndexedDB via `page.evaluate` instead |

Two devices in one spec are separate `browser.newContext()` calls. Do **not**
seed rows before injecting the auth session: `syncService.start()` runs on boot,
consumes the first-sync cursor, and will skip the first-merge prompt. Seed, then
sign in.

## Conventions
- Test files use `.spec.ts` for Playwright, `.test.ts` / `.test.tsx` for Vitest
- Vitest imports from `vitest` (not jest)
- Playwright imports from `@playwright/test`
- No test utility/shared helper files — keep seed logic inline to maintain test independence
