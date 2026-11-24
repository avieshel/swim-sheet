# Analytics Events Expansion — Owner Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add analytics events so the app owner gains full visibility into how users acquire the app, engage with it, discover content, run live sessions, and use the sharing, AI-draft, and live-timing features — including friction signals — without changing the delivery pipeline.

**Architecture:** New events follow the existing typed `Events.*` factory pattern in `client/src/services/analyticsEvents.ts` and are emitted via `analytics.track(...)`. The delivery pipeline (`analyticsService.ts`) is unchanged: every event already carries `user_id`, `device_id`, `session_id`, `app_version`, and device context, so the owner can segment by user/device out of the box. Live sessions remain local to the device (the earlier multi-device-live-sync redesign is explicitly out of scope); events are simply emitted per device.

**Tech Stack:** React 19 + TypeScript (strict), Vite PWA, Supabase (`analytics_events` table), existing `analytics.track` facade.

**Spec:** `docs/context/Analytics-Context.md` (event catalog, delivery pipeline, payload policy). Requirements derived from owner request: full visibility into acquisition, engagement, discovery, live-session behavior, content sharing, AI-draft adoption, and live-timing usage, plus friction (failure) signals for the new flows, to drive better product decisions.

## Out of scope (explicit)
- Cross-device live-session sync / relaxing the `isCompletedHistoryChange` active-run gate. Live sessions stay local to the device; this plan does not modify the sync engine or `sessionRuns` gating.
- Any change to the queue → batch → Supabase insert pipeline, dedupe, or retry logic.
- Building a full charting dashboard. The owner-view task delivers a minimal aggregated read-only table only.
- Onboarding events — there is no onboarding/tutorial flow in the app, so no events are added for it.
- Notification send/receive events — notifications are a setting toggle only (already tracked via `app_settings('toggle_notifications')`); no send/receive path exists.

## Privacy boundary (read this)
"Full visibility into user *actions*" is delivered. "Full visibility into user *data content*" is deliberately **not** — the payload policy ("counts, enums, and action types only — no swimmer names, lap times, or free-text notes") means you will see *what* users do and *aggregate* outcomes (e.g., total distance coached, swimmers trained), but never individual swimmer identities, raw lap times, or notes. This is by design and must not be relaxed when adding events.

## Global Constraints
- TypeScript `strict: true` (`tsconfig.app.json`) — `tsc -b` fails on violations.
- ESLint `no-console` (`error`) — no `console.log`/`warn`/`error`.
- ESLint `@typescript-eslint/no-explicit-any` (`error`) — no `any`.
- ESLint `no-restricted-imports` — pages/components must not import `db/` directly; analytics is reached through `services/analyticsEvents`.
- `noUnusedLocals` / `noUnusedParameters` — no unused symbols; removed `AppSettings` actions must be pruned so they are not dead.
- No AI-assistant attribution trailers (Co-Authored-By/Signed-off-by) in commit messages.
- No magic numbers for limits/constraints — any new numeric bound must live in a config module, never inlined. Runtime-measured durations (foreground_ms, dwell_ms) are not constants, so this does not apply; any added debounce/threshold must be configured.
- 4-layer architecture and existing patterns — add events to the `Events` registry, never as raw strings at call sites.
- Payload policy — every new event's `properties` must be counts/enums/ids only.

## Review Focus
1. **PII leak in new payloads** — a new event that includes a swimmer name, lap time, or free-text note violates the payload policy. Mitigation: a registry test asserting each new factory's property keys are limited to counts/enums/ids only.
2. **Stringly-typed drift** — a call site that hardcodes an event name instead of using the `Events.*` factory lets names drift from the registry. Mitigation: factory-only pattern; compile catches unknown names.
3. **Dead/duplicate account actions** — migrating `sign_in`/`sign_out` out of `AppSettings` but leaving them in the union, or leaving call sites on the old action, breaks compile or leaves dead code. Mitigation: prune the union and grep-confirm zero remaining callers.
4. **Engagement duration garbage** — `foreground_ms` / `dwell_ms` could be negative or `NaN` if timers are unavailable. Mitigation: factory coerces to a non-negative number.
5. **Search event floods the queue** — emitting `search_performed` on every keystroke would bloat the 500-cap queue. Mitigation: emit only on submit/debounced apply of a non-empty query.
6. **Owner view tenancy** — the read-only Usage view must read only appropriately-scoped rows (`user_id = auth.uid()`) and must not fail closed if the aggregation RPC/RLS is misconfigured. Mitigation: gate to signed-in and scope by `user_id`; note RLS assumption in the task.

---

## Complete Event Inventory — Added by This Plan
This is the consolidated list of **new** events this plan introduces, grouped by area, with the payload and the concrete insight / "better result" it enables. (Events already in the catalog — `app_opened`, `view_*`, swimmer/session/drill CRUD, the existing live-session events, `sync_error`, `plan_updated_by_other`, `app_settings`, etc. — remain and combine with these to form full funnels; they are not re-listed here.)

### Account & Retention
| Event | Payload | Insight → better result |
|-------|---------|--------------------------|
| `account_created` | `method` | Acquisition source; build signup cohorts. |
| `signed_in` | `method` (or `method, is_new`) | Login frequency & retention; DAU/WAU. |
| `signed_out` | — | Session-length proxy. |
| `app_foregrounded` | `last_background_ms \| null` | Return frequency; gaps between visits. |
| `app_backgrounded` | `foreground_ms` | Active time per session. |

### Engagement & Discovery
| Event | Payload | Insight → better result |
|-------|---------|--------------------------|
| `search_performed` | `scope`, `result_count` | Which catalogs users search & whether they find results → discoverability fixes. |
| `view_exited` | `screen`, `dwell_ms` | Time spent per screen → which features deliver value vs. dead ends. |

### Live Session behavior
| Event | Payload | Insight → better result |
|-------|---------|--------------------------|
| `session_paused` | — | Pause frequency/attention gaps during coaching. |
| `session_resumed` | — | Resume behavior; session continuity. |
| `timing_mode_selected` | `mode` (`manual`\|`automatic`) | Adoption of automatic vs manual timing. |

*(Existing live events already cover open/start, per-drill completion, swimmer start/complete, laps, run completion with distance/duration/swimmer counts, discard, reset, quick-time.)*

### Sharing, Backup & Friction
| Event | Payload | Insight → better result |
|-------|---------|--------------------------|
| `session_package_shared` | `drill_count`, `source` | Content spread by coaches. |
| `session_package_imported` | `drill_count`, `source`, `shared_by?` | Adoption of shared content. |
| `session_opened_via_share` | — | Top-of-funnel for shared links. |
| `share_failed` | `error_kind` | Sharing friction. |
| `package_import_failed` | `error_kind`, `source` | Import friction. |
| `backup_failed` | `error_kind` | Data-loss / backup friction risk. |

### AI Draft adoption & friction
| Event | Payload | Insight → better result |
|-------|---------|--------------------------|
| `ai_draft_requested` | `source` | AI feature interest. |
| `ai_draft_generated` | `drill_count`, `total_distance`, `source` | AI output volume. |
| `ai_draft_accepted` | `drill_count` | AI → production conversion rate. |
| `ai_draft_rejected` | — | AI drop-off / quality signal. |
| `ai_draft_failed` | `error_kind` | AI reliability. |

### Derived funnels the owner can now build
- **Activation:** `account_created` → `signed_in` → `view_sessions` → `session_created` → `live_session_opened` → `session_completed`.
- **Stickiness:** `app_opened` / `app_foregrounded` / `app_backgrounded` / `view_exited(dwell_ms)` over time.
- **Feature ROI:** `ai_draft_*` conversion, `session_package_*` spread, `timing_mode_selected` adoption, `search_performed` coverage.
- **Coaching outcomes:** `session_completed` (distance, swimmers, duration) + `drill_completed` + `lap_recorded` → aggregate training volume enabled.
- **Friction:** `*_failed`, `session_discarded`, `sync_error`, and empty-deck detection (`live_session_opened` with `roster_count>0` & `assigned_swimmer_count==0`).

---

### Task 1: Account lifecycle events

**Files:**
- Modify: `client/src/services/analyticsEvents.ts` (add factories; prune `AppSettings` union)
- Modify: `client/src/components/AccountSection.tsx` (lines ~170, 378, 391)
- Create: `client/src/services/__tests__/analyticsEvents.test.ts`
- Modify: sign-up success path (locate in `AuthProvider.tsx` / `AccountSection.tsx` — the account-creation handler)

**Interfaces:**
- Consumes: `analytics.track` (existing), `TrackedEvent` (existing).
- Produces: `Events.AccountCreated`, `Events.SignedIn`, `Events.SignedOut` used by Task 9 (owner view) and any future funnel.

- [ ] **Step 1: Write the failing test**

```ts
import { Events } from '../analyticsEvents'

describe('account lifecycle events', () => {
  it('AccountCreated carries method enum', () => {
    expect(Events.AccountCreated('google')).toEqual({
      name: 'account_created',
      properties: { method: 'google' },
    })
  })
  it('SignedIn carries method enum', () => {
    expect(Events.SignedIn('email')).toEqual({
      name: 'signed_in',
      properties: { method: 'email' },
    })
  })
  it('SignedOut has no properties', () => {
    expect(Events.SignedOut()).toEqual({ name: 'signed_out' })
  })
  it('AppSettings union no longer references sign_in/sign_out', () => {
    const allowed = ['sync','clear_data','set_equipment','set_pool_length','set_team_names','set_coach_name','backup_exported','backup_imported','cleanup_run','reset_settings','request_persist','set_data_retention','toggle_notifications'] as const
    expect(allowed).not.toContain('sign_in' as never)
    expect(allowed).not.toContain('sign_out' as never)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/services/__tests__/analyticsEvents.test.ts`
Expected: FAIL — `Events.AccountCreated` is not a function.

- [ ] **Step 3: Implement the three factories in `analyticsEvents.ts`**

Add to the `Events` object (mirroring existing factories):
- `AccountCreated: (method: 'google' | 'email' | 'test' | 'apple'): TrackedEvent` → `{ name: 'account_created', properties: { method } }`
- `SignedIn: (method: 'google' | 'email' | 'test' | 'apple'): TrackedEvent` → `{ name: 'signed_in', properties: { method } }`
- `SignedOut: (): TrackedEvent` → `{ name: 'signed_out' }`
Then remove `'sign_in'` and `'sign_out'` from the `AppSettings` `action` union (they are now dedicated events).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/services/__tests__/analyticsEvents.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire emissions**
- In `AccountSection.tsx`: replace `analytics.track(Events.AppSettings('sign_out'))` (line ~170) with `analytics.track(Events.SignedOut())`; replace the two `AppSettings('sign_in', { method })` calls (lines ~378, 391) with `analytics.track(Events.SignedIn(method))`.
- Locate the sign-up success handler (search `AuthProvider.tsx` / `AccountSection.tsx` for the account-creation path) and add `analytics.track(Events.AccountCreated(method))` on first account creation. If no distinct sign-up path exists (sign-in also creates the account), document that `AccountCreated` reuses the sign-in entry with an `is_new: boolean` flag — in that case add `is_new: boolean` to `SignedIn` instead and skip a separate `AccountCreated`. Confirm which during implementation and keep exactly one source of truth.

- [ ] **Step 6: Typecheck + lint**

Run: `cd client && npx tsc -b --noEmit && npx eslint src/services/analyticsEvents.ts src/components/AccountSection.tsx`
Expected: no errors; no remaining `AppSettings('sign_in'` / `'sign_out'` references.

- [ ] **Step 7: Commit**

```bash
git add client/src/services/analyticsEvents.ts client/src/services/__tests__/analyticsEvents.test.ts client/src/components/AccountSection.tsx
git commit -m "feat(analytics): add account lifecycle events"
```

---

### Task 2: App engagement (foreground/background) events

**Files:**
- Modify: `client/src/services/analyticsEvents.ts` (add factories)
- Modify: `client/src/App.tsx` (add visibility listeners)
- Modify: `client/src/services/__tests__/analyticsEvents.test.ts` (extend)

**Interfaces:**
- Consumes: existing `analytics.track`, `isNewSession` (existing).
- Produces: `Events.AppForegrounded`, `Events.AppBackgrounded`.

- [ ] **Step 1: Write the failing test**

```ts
it('AppBackgrounded carries non-negative foreground_ms', () => {
  const e = Events.AppBackgrounded(1234)
  expect(e).toEqual({ name: 'app_backgrounded', properties: { foreground_ms: 1234 } })
})
it('AppForegrounded carries last_background_ms or null', () => {
  expect(Events.AppForegrounded(5000)).toEqual({ name: 'app_foregrounded', properties: { last_background_ms: 5000 } })
  expect(Events.AppForegrounded(null)).toEqual({ name: 'app_foregrounded', properties: { last_background_ms: null } })
})
```

- [ ] **Step 2: Run test to verify it fails** (same test file command) → FAIL.

- [ ] **Step 3: Implement factories**
- `AppBackgrounded: (foregroundMs: number): TrackedEvent` → `properties: { foreground_ms: Math.max(0, Math.round(foregroundMs)) }`
- `AppForegrounded: (lastBackgroundMs: number | null): TrackedEvent` → `properties: { last_background_ms: lastBackgroundMs === null ? null : Math.max(0, Math.round(lastBackgroundMs)) }`

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Wire in `App.tsx`**
Add a module-scoped `let foregroundSince = Date.now()` and two `document.visibilitychange` listeners (the file already imports `analytics`/`isNewSession` for `app_opened`): on transition to `hidden`, emit `AppBackgrounded(Date.now() - foregroundSince)`; on transition to `visible`, emit `AppForegrounded(previous hidden duration or null)` and reset `foregroundSince = Date.now()`. Guard against `NaN`/negative via the factory coercion. Do not double-emit with the existing `pagehide`/visibility flush logic — these are separate analytics events, not flush triggers.

- [ ] **Step 6: Typecheck + lint** (`tsc -b --noEmit`, eslint on the two files) → clean.

- [ ] **Step 7: Commit**

```bash
git add client/src/services/analyticsEvents.ts client/src/App.tsx client/src/services/__tests__/analyticsEvents.test.ts
git commit -m "feat(analytics): add app foreground/background engagement events"
```

---

### Task 3: Search / discovery event

**Files:**
- Modify: `client/src/services/analyticsEvents.ts` (add factory)
- Modify: `client/src/services/__tests__/analyticsEvents.test.ts` (extend)
- Modify: search/filter handlers in `SwimmersList.tsx`, `SessionsList.tsx`, `DrillBank.tsx`, `RunsHistory.tsx` (locate the control that applies a non-empty query/filter)

**Interfaces:**
- Consumes: `analytics.track`.
- Produces: `Events.SearchPerformed`.

- [ ] **Step 1: Write the failing test**

```ts
it('SearchPerformed carries scope enum and result_count', () => {
  expect(Events.SearchPerformed('swimmers', 12)).toEqual({
    name: 'search_performed',
    properties: { scope: 'swimmers', result_count: 12 },
  })
})
```

- [ ] **Step 2: Run test → FAIL.**

- [ ] **Step 3: Implement factory**
- `SearchPerformed: (scope: 'swimmers' | 'sessions' | 'drills' | 'runs', resultCount: number): TrackedEvent` → `properties: { scope, result_count: resultCount }`.

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Wire emissions**
For each of the four list pages, locate the search input / filter "apply" handler (submit, debounced input, or filter chip selection). Emit `analytics.track(Events.SearchPerformed(scope, resultCount))` only when the applied query is **non-empty** (or a filter is actively selected), where `resultCount` is the number of rows after filtering. **Do not emit per keystroke** — emit on submit/debounce/selection only (see Review Focus #5). Map scope per page: `SwimmersList`→`'swimmers'`, `SessionsList`→`'sessions'`, `DrillBank`→`'drills'`, `RunsHistory`→`'runs'`.

- [ ] **Step 6: Typecheck + lint → clean.**

- [ ] **Step 7: Commit**

```bash
git add client/src/services/analyticsEvents.ts client/src/services/__tests__/analyticsEvents.test.ts client/src/pages/SwimmersList.tsx client/src/pages/SessionsList.tsx client/src/pages/DrillBank.tsx client/src/pages/RunsHistory.tsx
git commit -m "feat(analytics): add search/discovery event"
```

---

### Task 4: Sharing, backup & failure events

**Files:**
- Modify: `client/src/services/analyticsEvents.ts` (add factories + types)
- Modify: `client/src/services/__tests__/analyticsEvents.test.ts` (extend)
- Modify: `client/src/components/SessionPackageImportModal.tsx` (import flow)
- Modify: `client/src/pages/Settings.tsx` (backup export/import failure)
- Modify: the share-link / package-export creation entry point (locate — e.g. a `ShareSessionModal` or a share action in `SessionDetail.tsx` / `SessionsList.tsx`; if it does not exist yet, create the emission at the point the share link / package blob is generated)

**Interfaces:**
- Consumes: `analytics.track`.
- Produces: `Events.SessionPackageShared`, `Events.SessionPackageImported`, `Events.SessionOpenedViaShare`, `Events.ShareFailed`, `Events.PackageImportFailed`, `Events.BackupFailed`.
- Note: existing `Events.SessionImported` (catalog import) is intentionally kept distinct from `SessionPackageImported` (shared-package/file import).

- [ ] **Step 1: Write the failing test**

```ts
it('SessionPackageShared carries drill_count and source', () => {
  expect(Events.SessionPackageShared(8, 'template')).toEqual({
    name: 'session_package_shared',
    properties: { drill_count: 8, source: 'template' },
  })
})
it('SessionPackageImported carries drill_count, source, shared_by', () => {
  expect(Events.SessionPackageImported(8, 'share_link', 'Coach A')).toEqual({
    name: 'session_package_imported',
    properties: { drill_count: 8, source: 'share_link', shared_by: 'Coach A' },
  })
})
it('ShareFailed carries error_kind', () => {
  expect(Events.ShareFailed('network')).toEqual({ name: 'share_failed', properties: { error_kind: 'network' } })
})
it('BackupFailed carries error_kind', () => {
  expect(Events.BackupFailed('quota')).toEqual({ name: 'backup_failed', properties: { error_kind: 'quota' } })
})
```

- [ ] **Step 2: Run test → FAIL.**

- [ ] **Step 3: Implement factories**
- `SessionPackageShared: (drillCount: number, source: 'template' | 'run'): TrackedEvent`
- `SessionPackageImported: (drillCount: number, source: 'share_link' | 'file', sharedBy?: string): TrackedEvent` (omit `shared_by` when undefined)
- `SessionOpenedViaShare: (): TrackedEvent` → `{ name: 'session_opened_via_share' }`
- `ShareFailed: (errorKind: string): TrackedEvent` → `{ name: 'share_failed', properties: { error_kind: errorKind } }`
- `PackageImportFailed: (errorKind: string, source: 'share_link' | 'file'): TrackedEvent` → `{ name: 'package_import_failed', properties: { error_kind: errorKind, source } }`
- `BackupFailed: (errorKind: string): TrackedEvent` → `{ name: 'backup_failed', properties: { error_kind: errorKind } }`

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Wire emissions**
- At the share-link / package-export creation point: emit `SessionPackageShared(drillCount, source)` on success and `ShareFailed(kind)` in the catch.
- In `SessionPackageImportModal.tsx`: emit `SessionPackageImported(drillCount, source, sharedBy)` on successful import and `PackageImportFailed(kind, source)` in the catch.
- In `Settings.tsx`: at the backup export/import handlers (alongside the existing `AppSettings('backup_exported'|'backup_imported')`), emit `BackupFailed(kind)` in the catch.
- If the app can be opened directly from a share link (deep link / invite route), emit `SessionOpenedViaShare()` once on that entry. Locate the deep-link handler; if none exists, skip this event and note it.

- [ ] **Step 6: Typecheck + lint → clean.**

- [ ] **Step 7: Commit**

```bash
git add client/src/services/analyticsEvents.ts client/src/services/__tests__/analyticsEvents.test.ts client/src/components/SessionPackageImportModal.tsx client/src/pages/Settings.tsx <share-creation-file>
git commit -m "feat(analytics): add sharing, backup & failure events"
```

---

### Task 5: AI draft events

**Files:**
- Modify: `client/src/services/analyticsEvents.ts` (add factories)
- Modify: `client/src/services/__tests__/analyticsEvents.test.ts` (extend)
- Modify: `client/src/api/sessionDraft.ts` (or the generate call site) — request/generated/failed
- Modify: `client/src/pages/AiSessionDraft.tsx` and/or `client/src/components/ai/DraftSessionPanel.tsx` — accepted/rejected

**Interfaces:**
- Consumes: `analytics.track`.
- Produces: `Events.AiDraftRequested`, `Events.AiDraftGenerated`, `Events.AiDraftAccepted`, `Events.AiDraftRejected`, `Events.AiDraftFailed`.

- [ ] **Step 1: Write the failing test**

```ts
it('AiDraftGenerated carries drill_count, total_distance, source', () => {
  expect(Events.AiDraftGenerated(10, 1500, 'harness')).toEqual({
    name: 'ai_draft_generated',
    properties: { drill_count: 10, total_distance: 1500, source: 'harness' },
  })
})
it('AiDraftFailed carries error_kind', () => {
  expect(Events.AiDraftFailed('rate_limited')).toEqual({ name: 'ai_draft_failed', properties: { error_kind: 'rate_limited' } })
})
```

- [ ] **Step 2: Run test → FAIL.**

- [ ] **Step 3: Implement factories**
- `AiDraftRequested: (source: 'harness' | 'direct'): TrackedEvent`
- `AiDraftGenerated: (drillCount: number, totalDistance: number, source: 'harness' | 'direct'): TrackedEvent`
- `AiDraftAccepted: (drillCount: number): TrackedEvent`
- `AiDraftRejected: (): TrackedEvent`
- `AiDraftFailed: (errorKind: string): TrackedEvent`

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Wire emissions**
- In the AI generate call site (`api/sessionDraft.ts` or the harness invocation): emit `AiDraftRequested(source)` before the call, `AiDraftGenerated(drillCount, totalDistance, source)` on success, `AiDraftFailed(kind)` in the catch.
- In the draft review UI (`AiSessionDraft.tsx` / `DraftSessionPanel.tsx`): emit `AiDraftAccepted(drillCount)` when the user applies the draft to a template, `AiDraftRejected()` when they discard it.

- [ ] **Step 6: Typecheck + lint → clean.**

- [ ] **Step 7: Commit**

```bash
git add client/src/services/analyticsEvents.ts client/src/services/__tests__/analyticsEvents.test.ts client/src/api/sessionDraft.ts client/src/pages/AiSessionDraft.tsx client/src/components/ai/DraftSessionPanel.tsx
git commit -m "feat(analytics): add AI draft lifecycle events"
```

---

### Task 6: Timing-mode selection event

**Files:**
- Modify: `client/src/services/analyticsEvents.ts` (add factory)
- Modify: `client/src/services/__tests__/analyticsEvents.test.ts` (extend)
- Modify: the live-session setup control where the coach picks manual vs automatic timing (locate in `ActiveRunView.tsx` or the live-setup modal — search for the timing-mode toggle)

**Interfaces:**
- Consumes: `analytics.track`.
- Produces: `Events.TimingModeSelected`.

- [ ] **Step 1: Write the failing test**

```ts
it('TimingModeSelected carries mode enum', () => {
  expect(Events.TimingModeSelected('automatic')).toEqual({ name: 'timing_mode_selected', properties: { mode: 'automatic' } })
})
```

- [ ] **Step 2: Run test → FAIL.**

- [ ] **Step 3: Implement factory**
- `TimingModeSelected: (mode: 'manual' | 'automatic'): TrackedEvent` → `properties: { mode }`.

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Wire emission**
At the timing-mode selection control in the live-session setup: emit `analytics.track(Events.TimingModeSelected(mode))` when the coach chooses/confirms the mode. Locate the exact toggle; if timing mode is chosen implicitly (no explicit control), emit it from the live-session-open path (`useStartLiveSession`) with the resolved mode.

- [ ] **Step 6: Typecheck + lint → clean.**

- [ ] **Step 7: Commit**

```bash
git add client/src/services/analyticsEvents.ts client/src/services/__tests__/analyticsEvents.test.ts <timing-mode-control-file>
git commit -m "feat(analytics): add timing-mode selection event"
```

---

### Task 7: Live session pause / resume events

**Files:**
- Modify: `client/src/services/analyticsEvents.ts` (add factories)
- Modify: `client/src/services/__tests__/analyticsEvents.test.ts` (extend)
- Modify: the pause/resume toggle handler (`LiveSessionHeader.tsx:113-129` button → the `ActiveRunView.tsx` / `LiveSessionContext` handler that flips `sessionRunning`)

**Interfaces:**
- Consumes: `analytics.track`.
- Produces: `Events.SessionPaused`, `Events.SessionResumed`.

- [ ] **Step 1: Write the failing test**

```ts
it('SessionPaused has no properties', () => {
  expect(Events.SessionPaused()).toEqual({ name: 'session_paused' })
})
it('SessionResumed has no properties', () => {
  expect(Events.SessionResumed()).toEqual({ name: 'session_resumed' })
})
```

- [ ] **Step 2: Run test → FAIL.**

- [ ] **Step 3: Implement factories**
- `SessionPaused: (): TrackedEvent` → `{ name: 'session_paused' }`
- `SessionResumed: (): TrackedEvent` → `{ name: 'session_resumed' }`

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Wire emissions**
At the handler that toggles `sessionRunning` (the Pause/Resume button in `LiveSessionHeader.tsx`): emit `Events.SessionPaused()` when pausing and `Events.SessionResumed()` when resuming. These pair with the existing `session_completed` / `session_discarded` to reveal pause behavior and total active-vs-paused time.

- [ ] **Step 6: Typecheck + lint → clean.**

- [ ] **Step 7: Commit**

```bash
git add client/src/services/analyticsEvents.ts client/src/services/__tests__/analyticsEvents.test.ts client/src/components/live/LiveSessionHeader.tsx
git commit -m "feat(analytics): add live session pause/resume events"
```

---

### Task 8: Screen dwell (view_exited) event

**Files:**
- Modify: `client/src/services/analyticsEvents.ts` (add factory + `ScreenName` type)
- Modify: `client/src/services/__tests__/analyticsEvents.test.ts` (extend)
- Modify: `SwimmersList.tsx`, `SwimmerDetail.tsx`, `SessionsList.tsx`, `SessionDetail.tsx`, `DrillBank.tsx`, `CoachDashboard.tsx`, `RunsHistory.tsx` (emit on unmount with dwell)

**Interfaces:**
- Consumes: `analytics.track`.
- Produces: `Events.ViewExited`.
- Note: complements the existing mount-time `view_*` events by adding time-on-screen.

- [ ] **Step 1: Write the failing test**

```ts
it('ViewExited carries screen enum and non-negative dwell_ms', () => {
  expect(Events.ViewExited('dashboard', 4200)).toEqual({
    name: 'view_exited',
    properties: { screen: 'dashboard', dwell_ms: 4200 },
  })
  expect(Events.ViewExited('sessions', -5)).toEqual({ name: 'view_exited', properties: { screen: 'sessions', dwell_ms: 0 } })
})
```

- [ ] **Step 2: Run test → FAIL.**

- [ ] **Step 3: Implement factory**
- `type ScreenName = 'swimmers' | 'swimmer_profile' | 'sessions' | 'session_template' | 'drill_bank' | 'dashboard' | 'runs_history'`
- `ViewExited: (screen: ScreenName, dwellMs: number): TrackedEvent` → `properties: { screen, dwell_ms: Math.max(0, Math.round(dwellMs)) }`

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Wire emissions**
In each listed page component, capture `const mountedAt = Date.now()` on mount and emit `analytics.track(Events.ViewExited(screen, Date.now() - mountedAt))` in the effect cleanup (unmount). Map `screen`: `SwimmersList`→`'swimmers'`, `SwimmerDetail`→`'swimmer_profile'`, `SessionsList`→`'sessions'`, `SessionDetail`→`'session_template'`, `DrillBank`→`'drill_bank'`, `CoachDashboard`→`'dashboard'`, `RunsHistory`→`'runs_history'`. (The live deck already yields engagement via `session_*` events, so it is excluded here.)

- [ ] **Step 6: Typecheck + lint → clean.**

- [ ] **Step 7: Commit**

```bash
git add client/src/services/analyticsEvents.ts client/src/services/__tests__/analyticsEvents.test.ts client/src/pages/SwimmersList.tsx client/src/pages/SwimmerDetail.tsx client/src/pages/SessionsList.tsx client/src/pages/SessionDetail.tsx client/src/pages/DrillBank.tsx client/src/pages/CoachDashboard.tsx client/src/pages/RunsHistory.tsx
git commit -m "feat(analytics): add screen dwell (view_exited) event"
```

---

### Task 9: Owner visibility surface (minimal read-only Usage view)

**Files:**
- Create: `client/src/pages/Usage.tsx` (or `OwnerUsage.tsx`)
- Create: `supabase/migrations/<timestamp>_analytics_rollup_rpc.sql` (an RPC `analytics_event_rollup(window_days int)` returning `(event_name text, day date, count bigint)` grouped by `user_id = auth.uid()`)
- Modify: router (`client/src/App.tsx`) to mount the page for signed-in users
- Test: `client/src/pages/__tests__/Usage.test.tsx` (render + assert table rows from a mocked RPC)

**Interfaces:**
- Consumes: Supabase `analytics_events` (already populated by Tasks 1–8), `auth.uid()` for scoping.
- Produces: a read-only aggregated table the owner can open.

- [ ] **Step 1: Write the failing test**
Render `Usage` with a mocked Supabase client returning `[{ event_name: 'app_opened', day: '2026-11-20', count: 42 }, ...]`; assert the table lists `app_opened` with `42` and the page is gated (redirects/blank when no session).

- [ ] **Step 2: Run test → FAIL** (page does not exist).

- [ ] **Step 3: Implement**
- SQL migration: a `SECURITY DEFINER` (or RLS-scoped) RPC that `SELECT event_name, date_trunc('day', to_timestamp(timestamp/1000)) AS day, count(*) FROM analytics_events WHERE user_id = auth.uid() AND timestamp > extract(epoch from now() - (window_days || ' days')::interval)*1000 GROUP BY 1,2 ORDER BY 2 DESC, 3 DESC`. Confirm RLS/tenancy lets the owner read only their own `user_id` rows (Review Focus #6).
- `Usage.tsx`: call the RPC for a selectable 7/30-day window, render an accessible table (event name, day, count). No charts required. Show the total events and a per-event breakdown. Keep it read-only.

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Wire route** in `App.tsx` (signed-in only).

- [ ] **Step 6: Typecheck + lint → clean.**

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Usage.tsx client/src/pages/__tests__/Usage.test.tsx supabase/migrations/<timestamp>_analytics_rollup_rpc.sql client/src/App.tsx
git commit -m "feat(analytics): add read-only owner usage view"
```

---

### Task 10: Update Analytics-Context documentation

**Files:**
- Modify: `docs/context/Analytics-Context.md` (event catalog table + notes)

**Interfaces:** None (documentation only).

- [ ] **Step 1: Extend the event catalog table**
Add rows for every new event from Tasks 1–8 with their payload and emitted-from location, grouped under the relevant section (Account, Engagement, Discovery, Live Session, Sharing/Backup, AI, Screen Dwell). Add a note that `user_id` is already captured on every event (so owner segmentation by user/device works without pipeline changes), and reaffirm the payload policy (counts/enums only, no PII).

- [ ] **Step 2: Note the owner view** — reference the Usage page (Task 9) and the direct Supabase `analytics_events` query path.

- [ ] **Step 3: Commit**

```bash
git add docs/context/Analytics-Context.md
git commit -m "docs(analytics): document new owner-visibility events"
```

---

## Self-Review Notes
- **Spec coverage:** account acquisition/retention (Task 1), engagement duration (Task 2), discovery (Task 3), sharing + backup + friction (Task 4), AI adoption + friction (Task 5), live-timing usage (Task 6), live pause/resume (Task 7), screen dwell/engagement depth (Task 8), owner visibility (Task 9), docs (Task 10). All requirements from the request (full visibility into actions, better insights) are covered. The two user-action surfaces that were missing from the first draft — live-session pause/resume and screen-level dwell time — are now included.
- **Payload policy:** every new factory uses counts/enums/ids only; Task 1's test + Review Focus #1 pin the PII boundary. The privacy boundary section makes explicit that content (names, lap times, notes) is intentionally excluded.
- **No pipeline change:** Tasks 1–8 only touch `analyticsEvents.ts`, call sites, and tests; `analyticsService.ts` is untouched because `user_id`/`device_id`/context are already attached.
- **Out-of-scope honored:** sync engine and `sessionRuns` gating are not modified; live sessions remain device-local. Onboarding and notification-send events omitted because no such flows exist.
- **Derived funnels:** the inventory section lists the activation, stickiness, feature-ROI, coaching-outcome, and friction funnels the owner can now assemble from the combined existing + new event set.
