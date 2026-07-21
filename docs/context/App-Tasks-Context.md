# App Tasks

Remaining application-level work items. These should be converted to GitHub issues.

---

## A-018: Quick Time Lap — Path to value for new users

**Source**: User feedback — coach wants to time swimmers right now without onboarding

**Problem**: New coach cannot start timing without first defining swimmers and a session template.

**Solution**: "Quick Time" — app opens to `/` (root route) which auto-starts a quick-time session immediately (no picker, no taps). A run is created from the pre-configured **"Quick 100m freestyle (default)"** session template with a 100m freestyle drill and 3 default temp swimmers (Michael Phelps in Lane 1, Katie Ledecky + Caeleb Dressel in Lane 2), plus "Add Swimmer" / "Temp Swimmer" buttons to scale up instantly. The default session is a regular visible session — users can edit or delete it.

**Design doc**: `docs/context/Quick-Start-Context.md`

**Implementation steps**:

1. **Service** (`client/src/services/runService.ts`):
   - `createQuickStartRun()` finds or creates the default session template ("Quick 100m freestyle (default)") with one 100m freestyle drill, creates a run via `createFromTemplate()`, returns `{ runId, drillId }`
   - Default session is visible (no `system: true` flag), appears in Sessions list like any other session
2. **Service** (`client/src/services/sessionService.ts`): Removed system session filter — all sessions now visible
3. **LiveDeck** (`client/src/pages/LiveDeck.tsx`):
   - Removed `SessionPicker` component — no dropdown, no "Start Timing" button
   - Auto-start behavior via `useRef`-guarded `handleQuickStart()` — fires once when no active run exists
   - `handleQuickStart` creates 3 virtual swimmers: Lane 1 (1 swimmer), Lane 2 (2 swimmers — hints at multi-swimmer capability)
   - Page refresh recovery: virtual swimmer state serialized in `SessionRun.notes` JSON, restored grouped by lane
   - `handleComplete` guard: skip Lap creation for swimmers with `"quick-"` prefixed `dbId`
4. **App routing** (`client/src/App.tsx`): Root `/` → `LiveDeck`, `/dashboard` → `CoachDashboard`
5. **Constants** (`client/src/constants/`): `FAMOUS_SWIMMER_NAMES` array (31 famous swimmer names) used by "Temp Swimmer" button

**Key design decisions**:
- **No schema changes needed** — default session is a regular Session record, uses existing `createRunFromTemplate` path
- **Visible default session** — "Quick 100m freestyle (default)" appears in Sessions list, users can edit/delete it
- **App opens to `/`** — auto-starts quick-time session immediately, fastest path to value (no picker, no taps)
- **Lane 2 has 2 swimmers** — hints that multiple swimmers per lane are supported
- Virtual swimmers get synthetic `dbId: "quick-..."` — must be skipped in `handleComplete` Lap loop
- Page refresh recovery: virtual swimmer state serialized in `SessionRun.notes` JSON
- Full data model compatibility — history/review works identically for quick-time and full sessions

**Priority**: High
**Status**: Done — All steps completed. Quick Time Lap fully functional with auto-start, swimmer management, and name editing.

---

## A-001: Group card drag-and-drop reordering

**Source**: `TODO_TIMED_GROUPS.md`

Support drag-and-drop reordering of Group Cards in the live view. Use a library (e.g. dnd-kit) or native HTML5 drag API.

**Priority**: Medium
**Status**: Open

---

## A-002: Swimmer Mobility — MOVE_SWIMMER_TO_GROUP

**Source**: `TODO_TIMED_GROUPS.md`

Implement `MOVE_SWIMMER_TO_GROUP` with automatic reset of timing data for the destination group. Wire the UI action bar to confirm and execute the move.

**Priority**: High
**Status**: Done — `MOVE_SWIMMER_TO_GROUP` reducer action (atomic remove + add + reset swimmer state), `store.clearDrill()` on destination group in LiveDeck, `CLEAR_GROUP_SWIMMER_DATA` dispatched after move. 3 tests added (move, reset on move, no-op on missing swimmer).

---

## A-003: Visual clustering of same-lane groups

**Source**: `TODO_TIMED_GROUPS.md`

When two or more groups share the same physical lane number, visually cluster them (shared border, grouping indicator, etc.).

**Priority**: Low
**Status**: Open

---

## A-004: Purity audit — Remove business logic from DAO

**Source**: `ARCHITECTURE_REVIEW.md` (section 4.3)

**Note**: Import boundary from pages/components to `db/` is now enforced by ESLint `no-restricted-imports`. What remains is moving business logic functions out of `dao.ts`:

- `createRunFromTemplate` → `runService.ts`
- `patchLibraryDrills` → `drillService.ts`
- `seedLibraryDrills` → seeding service
- `resetLibraryToDefaults` → seeding service
- `clearSwimmerFromLaneDrillResult` → `runService.ts`
- `setLaneDrillResult` upsert logic → `runService.ts`

**Priority**: Medium
**Status**: In Progress — `setLaneDrillResult` and `deleteSwimmerFromLaneDrillResult` moved to `runService.ts`. Remaining items (seed data functions) deferred due to large hardcoded seed data (~400 lines).

---

## A-006: Move business rules out of LiveSessionContext reducer

**Source**: `ARCHITECTURE_REVIEW.md` (section 3.4)

Reducer actions contain business logic:
- `SWIMMER_START`: auto-assigns offset
- `SWIMMER_COMPLETE`: auto-appends elapsed
- `SPLIT_GROUP`: clones timer state
- `MOVE_SWIMMER_TO_GROUP`: resets timing data

Move these rules to `runService.ts` or a `timingService.ts`.

**Priority**: Low
**Status**: Done — Reducer reduced to ~18 structure-only actions. All timestamp logic moved to `TimestampStore` (`timing/timestampStore.ts`). Lane-level batch stop in LiveDeck uses `store.batchStop()`.

---

## A-007: Stop auto-initializing 8 groups in LiveSessionContext

**Source**: `ARCHITECTURE_REVIEW.md` (section 5.2)

`useEffect` in LiveSessionContext creates 8 empty TimedGroups when state is empty. The context should be agnostic of lane count. Initialize only when a session starts.

**Priority**: Medium
**Status**: Done — `useEffect` removed. Groups initialized only via `INIT` action dispatched from `LiveSessionProvider` when a session starts.

---

## A-008: Server schema alignment — Add missing tables

**Source**: `ARCHITECTURE_REVIEW.md` (section 4.4)

Server SQLite is missing:
- `lane_drill_results` table (client-side only currently)
- `library_drills` table

These need to be added for proper sync support.

**Priority**: Low
**Status**: Open

---

## A-009: Sync engine — Fix API path mismatches

**Source**: `ARCHITECTURE_REVIEW.md` (section 2.4)

Sync engine pushes to `/api/swimmers`, `/api/sessions`, `/api/laps` but server expects `/api/v1/swimmers`, etc. Also, data format mismatches (client sends `run_drill_id`, server Laps route expects `session_id`).

**Priority**: Low
**Status**: Open

---

## A-010: Add E2E tests for group operations

**Source**: `Test-Context.md`

No E2E coverage for:
- Group split flow
- Swimmer move between groups
- Group rename
- Lane reassignment

**Priority**: Medium
**Status**: Open

---

## A-011: Add E2E tests for Settings page

**Source**: `Test-Context.md`

Settings page has no E2E coverage.

**Priority**: Low
**Status**: Open

---

## A-012: History/review feature

**Source**: `USER-FLOWS.md` (flow 5)

Browse completed SessionRuns, view per-swimmer lap data for historical runs. No implementation yet (route needed, UI needed).

**Priority**: Low
**Status**: Open

---

## A-013: Remove LaneView.tsx stub

**Source**: `ARCHITECTURE_REVIEW.md` (section 5.3)

`client/src/pages/LaneView.tsx` is an empty placeholder. Remove if unused, or implement if needed.

**Priority**: Low
**Status**: Done — Deleted unused `LaneView.tsx` stub.

---

## A-014: Drill bank — Server sync for library drills

LibraryDrill is client-only. No server table or API routes exist. Needed for cross-device sync of custom drills.

**Priority**: Low
**Status**: Open

---

## A-015: Drill similarity detection ✅

**Source**: User request

When creating a drill (in DrillBank or SessionDetail), detect similar existing drills to prevent duplicates. Shows a warning banner with matching drills before allowing creation.

**Implementation**:
- Added `findSimilarDrills`, `levenshteinDistance`, `levenshteinRatio` + `SimilarDrill` interface in `utils/drillHelpers.ts`
- Scoring: name (0.5), stroke (0.15), distance proximity (0.15), focus match (0.1), label overlap (0.1)
- DrillBank and SessionDetail onSave now check similarity before saving; show dismissible warning with "Create Anyway" / "Cancel"
- 13 unit tests in `utils/__tests__/drillHelpers.test.ts`

**Schema changes**: None

**Files modified**:
- `client/src/utils/drillHelpers.ts` — added `findSimilarDrills`
- `client/src/utils/__tests__/drillHelpers.test.ts` — created, 13 tests
- `client/src/pages/DrillBank.tsx` — similarity check on drill create/edit
- `client/src/pages/SessionDetail.tsx` — similarity check against session + library drills

**Priority**: Medium
**Status**: Done

---

## A-017: Drill bank dedup — Prevent and clean up duplicate library drills ✅

**Source**: User complaint — drill bank showed many duplicate drills

Two changes:

1. **`addLibraryDrill` upserts by name** — if a library drill with the same name already exists, it updates the existing record instead of creating a new one. This prevents the main source of duplicates: `addDrill` auto-saving session drills to the library (each session drill creation was creating a new library entry even if one with the same name existed).

2. **`deduplicateLibraryDrills()` batch cleanup** — runs on DrillBank load. Groups all library drills by exact name, keeps the most complete entry (builtin source preferred, then description/labels/focus completeness), and deletes the rest. Items are merged from duplicates if the kept drill has none.

**Files modified**:
- `client/src/db/dao.ts` — `addLibraryDrill`: upsert by name; new `deduplicateLibraryDrills()`
- `client/src/services/drillService.ts` — exposes `deduplicateLibrary()`
- `client/src/api/drills.ts` — exports `deduplicateLibraryDrills()`
- `client/src/pages/DrillBank.tsx` — calls dedup on initial load and after saves/resets
- `docs/context/App-Context.md` — design decisions entry

**Priority**: High
**Status**: Done

---

## A-016: Session template drill tags (warmup/main-set/cooldown) ✅

**Source**: User request

When creating a session template, tag drills as 'warmup', 'main-set', or 'cooldown'. In the live view, warmup/cooldown drills default to paused timing (coach can override); main-set drills default to timed.

**Implementation**:
- Added `tag?: 'warmup' | 'main-set' | 'cooldown'` to `Drill` interface and `tag?: string` to `RunDrill`
- Added `showTags` prop to `DrillEditorModal` — renders tag selector chips (enabled in SessionDetail)
- `createFromTemplate` copies `tag` from Drill to RunDrill
- `SET_GROUP_DRILL` action accepts optional `autoStart`; LiveDeck passes `autoStart: tag !== 'warmup' && tag !== 'cooldown'`
- Server: `ALTER TABLE` for `drills` and `run_drills` (gracefully handles existing columns)
- Tag badges displayed on drill cards in SessionDetail

**Schema changes**:
- Client: `Drill.tag?`, `RunDrill.tag?`
- Server: `drills.tag TEXT`, `run_drills.tag TEXT`

**Files modified**:
- `client/src/db/schema.ts` — `Drill.tag?`, `RunDrill.tag?`
- `client/src/components/DrillEditorModal.tsx` — `showTags` prop, tag selector UI
- `client/src/pages/SessionDetail.tsx` — `showTags={true}`, tag badges
- `client/src/services/runService.ts` — copies tag in `createFromTemplate`
- `client/src/context/LiveSessionContext.tsx` — `autoStart` in `SET_GROUP_DRILL`
- `client/src/pages/LiveDeck.tsx` — passes `autoStart` based on tag
- `server/src/db/schema.ts` — ALTER TABLE for tag columns
- `client/src/context/__tests__/LiveSessionContext.test.ts` — 2 new tests

**Priority**: Medium
**Status**: Done
