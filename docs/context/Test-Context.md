# SwimSheet Test Context

## Testing Stack

| Type | Tool | Location | Command |
|------|------|----------|---------|
| Unit / Integration | Vitest | `client/src/**/*.test.ts` (co-located) | `npm run test` |
| E2E | Playwright | `tests/` at project root | `npm run test:e2e` |

## Test Philosophy

1. **Unit tests** verify pure functions (utils, lap editing, format helpers) and service logic.
2. **Service tests** verify business operations against a real Dexie instance (in-memory IndexedDB via `fake-indexeddb` or similar).
3. **E2E tests** verify critical user flows against a running app (client dev server + mocked/real server).
4. **No snapshot testing** — assertions should be explicit about values.
5. **No enzyme/react-testing-library** for component rendering — we rely on Playwright for UI verification.

---

## Unit Tests (`vitest`)

### Location
Test files are co-located with source files in `__tests__/` directories:
- `client/src/utils/` — `lapEditing.test.ts`
- `client/src/services/` — `drillService.test.ts`, `runService.test.ts`, `sessionService.test.ts`, `swimmerService.test.ts`

### What to Unit Test
- Pure utility functions (lap editing, time formatting, stroke aggregation)
- Service methods with clear inputs/outputs
- Data transformations (cumulative ↔ split conversion)

### What NOT to Unit Test
- React components (use Playwright instead)
- Dexie/IndexedDB internals
- Express route handlers

---

## E2E Tests (`playwright`)

### Location
- `tests/` at project root (Playwright config at `playwright.config.ts`)

### Current Test Files
| File | What it tests |
|------|---------------|
| `drill-timer.spec.ts` | Live deck drill timing and advancement |
| `layout-responsive.spec.ts` | Responsive grid layouts at 1/2/3/4-column + mobile |
| `live-deck.spec.ts` | Live deck group operations, swimmer controls |
| `persistence.spec.ts` | Drill auto-save to LaneDrillResult on all-done |
| `PoolLengthSelect.spec.ts` | Pool length selector behavior |

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
| Live deck — timer start | E2E | Covered |
| Live deck — group split | E2E | Needed |
| Live deck — swimmer move | E2E | Needed |
| Session template CRUD | E2E | Partial |
| Responsive layout | E2E | Covered (flaky — Dexie timing) |
| Drill persistence | E2E | Covered (flaky — Dexie timing) |
| Settings | E2E | Not covered |
| History/review | E2E | Not implemented yet |

## Known Flaky Tests
E2E tests that seed Dexie via `page.evaluate` may fail if Dexie hasn't finished opening. Mitigation:
- Always use `waitForFunction(() => (window as any).db?.isOpen?.())` before evaluate
- Retry logic within evaluate as fallback

## Conventions
- Test files use `.spec.ts` for Playwright, `.test.ts` for Vitest
- Vitest imports from `vitest` (not jest)
- Playwright imports from `@playwright/test`
- No test utility/shared helper files — keep seed logic inline to maintain test independence
