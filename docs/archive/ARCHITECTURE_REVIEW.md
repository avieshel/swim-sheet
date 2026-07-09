# Architecture Review — Client Application

This document catalogs every place the client application violates the four-layer architecture boundary (UI, API, Services, Data Access).

## Summary

The codebase currently has **no service layer**, **no client-side API abstraction**, an **impure data access layer** (mixing CRUD with business logic), and a **UI layer** that imports and calls DAO functions directly. Below is a file-by-file breakdown.

---

## 1. UI Layer Violations

### 1.1 Pages import and call DAO directly

Every page component imports from `../db/dao` and calls CRUD functions inline, treating DAO as if it were the service/API layer. Pages should only dispatch actions or call an API abstraction — they should not know about Dexie.

| File | Line(s) | What it does |
|---|---|---|
| `client/src/pages/CoachDashboard.tsx` | 3, 17–41 | Imports `getAllSessions`, `getAllSwimmers`, `getAllLaps`, `getCompletedRuns`, `getRunDrill`; calls them directly in a `useEffect` |
| `client/src/pages/SwimmersList.tsx` | 3, 27–29, 53–55, 62 | Imports `getAllSwimmers`, `addSwimmer`, `updateSwimmer`, `deleteSwimmer`; calls directly |
| `client/src/pages/SwimmerDetail.tsx` | 3, 21, 27, 49, 56 | Imports `getSwimmer`, `updateSwimmer`, `deleteSwimmer`, `getRunsForSwimmer`, `getSession`; calls directly |
| `client/src/pages/SessionsList.tsx` | 4, 45, 48, 70, 87 | Imports `getAllSessions`, `addSession`, `deleteSession`, `getDrillsForSession`, `getCompletedRuns`, `getSession`; calls directly |
| `client/src/pages/SessionDetail.tsx` | 5, 162, 168 | Imports `getSession`, `updateSession`, `getDrillsForSession`, `addDrill`, `deleteDrill`, `updateDrill`, `getAllLibraryDrills`, `updateLibraryDrill`, `deleteLibraryDrill`, `seedLibraryDrills`; calls directly |
| `client/src/pages/DrillBank.tsx` | 4, 140–144 | Imports `getAllLibraryDrills`, `updateLibraryDrill`, `deleteLibraryDrill`, `addLibraryDrill`, `resetLibraryToDefaults`, `patchLibraryDrills`; calls directly |
| `client/src/pages/LiveDeck.tsx` | 4, 217, 256–267, 1329, 1339, 1363–1386, 1405–1418, 1436–1468, 1508–1539 | Imports and calls ~20+ DAO functions directly |

### 1.2 Duplicated swimmer add/edit modals

The add/edit swimmer form is defined inline in two separate pages instead of being extracted as a shared component.

| File | Lines | Notes |
|---|---|---|
| `client/src/pages/SwimmersList.tsx` | 246–315 | Inline modal with name/group/notes fields |
| `client/src/pages/SwimmerDetail.tsx` | 159–224 | Nearly identical inline modal |

### 1.3 Duplicated rich drill editor modal

The full drill editor (name, description, set repeats, timing mode, phase/focus labels, set components with reps/distance/stroke/intensity/interval/equipment) is copy-pasted between two files.

| File | Lines | Notes |
|---|---|---|
| `client/src/pages/SessionDetail.tsx` | 408–728 | ~320 lines of near-identical modal code |
| `client/src/pages/DrillBank.tsx` | 312–600 | ~288 lines of near-identical modal code |

Both define the same drill item editor layout, same `EQUIPMENT_OPTIONS`, `TECHNIQUE_LABELS`, `FITNESS_LABELS`, `PHASE_LABELS`, `strokeOptions`, `getDrillTotalDistance`, `CustomSelect`, and `EquipmentIcons` imports.

### 1.4 Duplicated CustomSelect component

| File | Lines |
|---|---|
| `client/src/pages/SessionDetail.tsx` | 51–104 |
| `client/src/pages/DrillBank.tsx` | 55–108 |

### 1.5 Settings page uses custom inline modal instead of ConfirmDialog

| File | Lines | What it does |
|---|---|---|
| `client/src/pages/Settings.tsx` | 307–332 | Inline modal for reset confirmation instead of using `<ConfirmDialog>` |

### 1.6 Components defined inside LiveDeck.tsx (not extractable/reusable)

| Component | File | Lines | Problem |
|---|---|---|---|
| `LaneEditorModal` | `client/src/pages/LiveDeck.tsx` | 10–191 | Defined as inner function; cannot be imported or tested independently |
| `SessionSetup` | `client/src/pages/LiveDeck.tsx` | 203–414 | Defined as inner function |
| `GroupCard` | `client/src/pages/LiveDeck.tsx` | 418–1313 | Defined as inner function; massive ~895 lines |
| `ActiveRunView` | `client/src/pages/LiveDeck.tsx` | 1315–1648 | Defined as inner function |
| `LapTimeline` | `client/src/pages/LiveDeck.tsx` | 528–805 | Defined inside `GroupCard`; impossible to unit test |

### 1.7 Business logic helpers defined in page files

| Function | File | Lines | Should live in |
|---|---|---|---|
| `aggregateByStroke` | `client/src/pages/SessionsList.tsx` | 290–296 | `utils/` or a service |
| `detectFocus` | `client/src/pages/SessionsList.tsx` | 298–323 | `utils/` or a service |
| `formatTime` | `client/src/pages/LiveDeck.tsx` | 193–199 | `utils/` |

### 1.8 Shared constants duplicated

`EQUIPMENT_OPTIONS`, `TECHNIQUE_LABELS`, `FITNESS_LABELS`, `PHASE_LABELS`, `strokeOptions`, and `strokeColors` are defined identically in both `SessionDetail.tsx` and `DrillBank.tsx`. These should be in a shared constants file.

---

## 2. API Layer Violations

### 2.1 No client-side API abstraction exists

There is zero client-side API wrapper. Operations fall into three patterns, none of which go through a unified API:

- **Local ops**: Pages call `dao.ts` functions directly (bypassing any API layer)
- **Server sync**: `syncEngine.ts` uses raw `fetch()` with hardcoded URL paths
- **Settings**: Uses raw `fetch('http://localhost:3001/api/v1/settings')` with a hardcoded origin

### 2.2 Settings page hardcodes localhost URL

| File | Lines | Code |
|---|---|---|
| `client/src/pages/Settings.tsx` | 36 | `fetch('http://localhost:3001/api/v1/settings')` |
| `client/src/pages/Settings.tsx` | 73 | `fetch('http://localhost:3001/api/v1/settings', ...)` |
| `client/src/pages/Settings.tsx` | 88 | `fetch('http://localhost:3001/api/v1/settings/reset', ...)` |

This breaks in production (Docker deployment, or when accessed from another device on the network). The Vite proxy config is bypassed.

### 2.3 LiveDeck uses raw Dexie query bypassing even DAO

| File | Line | Code |
|---|---|---|
| `client/src/pages/LiveDeck.tsx` | 1661 | `db.runSwimmers.where('run_id').equals(run.id).toArray()` |

Imports `db` directly from `../db/dao` (line 4) and queries the underlying Dexie table — completely bypassing all layers.

### 2.4 Sync engine uses mismatched API paths

| File | Lines | Path used | Server expects |
|---|---|---|---|
| `client/src/sync/syncEngine.ts` | 52, 53, 54, 77, 78, 79 | `/api/swimmers`, `/api/sessions`, `/api/laps` | `/api/v1/swimmers`, `/api/v1/sessions`, `/api/v1/laps` |

Additionally, the sync engine pushes data in formats that don't match server expectations (e.g., server `laps` route expects `session_id`, but client stores `run_drill_id`).

### 2.5 No API layer for the local Dexie database

Even though the app runs locally, the user wants an API boundary. Currently there's no `api/` directory or module. Potential approaches:
- An in-memory API service that wraps all operations
- A consistent `fetch`-style interface, even when hitting Dexie

---

## 3. Services Layer Violations

### 3.1 No service layer exists

There are zero `*Service.ts` or `*Service.js` files in the entire client. All logic should be organized into domain services (e.g., `swimmerService`, `sessionService`, `drillService`, `runService`).

### 3.2 Business logic lives in the DAO layer

The following functions in `client/src/db/dao.ts` contain business/domain logic that belongs in services:

| Function | Lines | Why it's not data access |
|---|---|---|
| `createRunFromTemplate` | 248–322 | Complex orchestration: loads session + drills, creates run, unrolls grouped/individual drill items into RunDrills, calculates totals. This is the core "start session" business flow. |
| `clearSwimmerFromLaneDrillResult` | 232–242 | Parses JSON, filters swimmer data, updates — this is data transformation logic, not raw CRUD |
| `setLaneDrillResult` | 207–218 | Contains upsert logic (check if exists → update vs insert) — business rule |
| `patchLibraryDrills` | 424–595 | Massive enrichment logic: iterates all defaults, checks conditions, updates — data migration logic |
| `seedLibraryDrills` | 602–819 | Seed data + conditional insertion — belongs in a setup/seeding service |
| `resetLibraryToDefaults` | 597–600 | Orchestrates clear + seed — coordination logic |

### 3.3 Business logic lives in UI components

The following business operations are implemented directly inside page/component code rather than in services:

| Location | Lines | Logic |
|---|---|---|
| `LiveDeck.tsx` — `handleCompleteDrill` | 1436–1468 | Builds timing data JSON, calls `setLaneDrillResult`, refreshes state, advances to next drill |
| `LiveDeck.tsx` — `handleEditSavedSwimmer` | 1514–1539 | Parses saved JSON, applies updates, persists, refreshes |
| `LiveDeck.tsx` — `handleComplete` (session) | 1363–1386 | Iterates all groups/swimmers, converts laps to `addLap` calls, completes run |
| `LiveDeck.tsx` — `checkForActiveRun` | 1657–1694 | Loads run data, fetches swimmers, builds `TimedGroup[]` structure, dispatches INIT |
| `LiveDeck.tsx` — `handleResetDrill` / `handleResetGroup` / `handleResetSession` | 1470–1506 | Multi-step orchestration with deletes, refreshes, dispatches |
| `LiveDeck.tsx` — `addSwimmerToLane` / `addSwimmerToGroup` / `moveSwimmer` | 1405–1433 | Manages swimmer moves with confirmations, dual dispatch + DB persistence |
| `SessionDetail.tsx` — `handleAddFromLibrary` | 237–261 | Constructs drill data with defaults, calls `addDrill`, reloads |
| `SessionsList.tsx` — `loadSessions` | 43–64 | Loads sessions, then enriches each with drill totals, stroke breakdowns, focus detection |

### 3.4 Service-level state management mixed into LiveSessionContext

The context reducer (`client/src/context/LiveSessionContext.tsx`) contains business rules that should belong in a service:
- `SWIMMER_START`: Auto-assigns `offsetFromLaneStart = g.elapsed` for unstarted swimmers (line 120)
- `SWIMMER_COMPLETE`: Auto-appends elapsed to laps, auto-pauses timer when all done (lines 194–211)
- `SPLIT_GROUP`: Clones timer state to new group (lines 318–339)
- `MOVE_SWIMMER_TO_GROUP`: Resets all timing data on move (lines 340–368)

---

## 4. Data Access Layer Violations

### 4.1 DAO is exported directly (`export { db }`)

| File | Line | What it does |
|---|---|---|
| `client/src/db/dao.ts` | 4 | `export { db }` |

This exposes the raw Dexie database instance. Any consumer can perform arbitrary queries against tables, bypassing the DAO interface.

### 4.2 LiveDeck uses `db` directly

| File | Line | Code |
|---|---|---|
| `client/src/pages/LiveDeck.tsx` | 4, 1661 | `import { ..., db } from '../db/dao'` and `db.runSwimmers.where(...).toArray()` |

### 4.3 Mix of CRUD and business logic in DAO

Pure data access functions (acceptable) are mixed with domain logic functions (should be in services).

**Acceptable (pure CRUD):** `getAllSwimmers`, `addSwimmer`, `updateSwimmer`, `deleteSwimmer`, `getSession`, `getDrillsForSession`, `addLap`, `deleteLap`, etc.

**Unacceptable (business logic):** `createRunFromTemplate`, `patchLibraryDrills`, `seedLibraryDrills`, `resetLibraryToDefaults`, `clearSwimmerFromLaneDrillResult`

### 4.4 Server-side DAO also not aligned

The server at `server/src/db/schema.ts` defines a SQLite schema that doesn't match the client Dexie schema. The server is missing tables like `lane_drill_results`, `run_swimmers`, `library_drills`, and columns like `group_id`. The sync engine pushes/pulls incomplete data.

---

## 5. Additional Cross-Cutting Issues

### 5.1 No test coverage for architecture layers

- `client/src/utils/lapEditing.test.ts` — Only tests utility functions
- No tests exist for services, API layer, or DAO

### 5.2 LiveSessionContext auto-initializes 8 groups

| File | Lines | What |
|---|---|---|
| `client/src/context/LiveSessionContext.tsx` | 471–485 | `useEffect` creates 8 empty `TimedGroup`s when state is empty |

This couples the context (state management) to a UI assumption (8 lanes). The context should be agnostic of default layout.

### 5.3 `LaneView.tsx` is a stub placeholder

`client/src/pages/LaneView.tsx` exists as an empty placeholder. Route in `App.tsx` may or may not reference it.

---

## Recommended File Structure

```
client/src/
├── api/
│   ├── index.ts              # Unified API client (wraps both Dexie & HTTP)
│   ├── swimmerApi.ts         # Swimmer endpoint definitions
│   ├── sessionApi.ts
│   ├── runApi.ts
│   ├── drillApi.ts
│   ├── settingsApi.ts
│   └── syncApi.ts            # Server sync endpoints
├── services/
│   ├── swimmerService.ts     # Swimmer business operations
│   ├── sessionService.ts     # Session + drill template operations
│   ├── runService.ts         # SessionRun lifecycle (start, complete, reset)
│   ├── drillService.ts       # Template drill + library drill operations
│   ├── timingService.ts      # Lap timing, splits, offset calculations
│   └── seedingService.ts     # Library drill seeding/migration
├── db/
│   ├── schema.ts             # Dexie schema + types only
│   └── dao.ts                # Pure CRUD — no business logic
├── components/
│   ├── forms/
│   │   ├── SwimmerFormModal.tsx    # Single shared modal
│   │   ├── DrillEditorModal.tsx    # Single shared drill editor
│   │   └── LaneEditorModal.tsx     # Extracted from LiveDeck
│   ├── timing/
│   │   └── LapTimeline.tsx         # Extracted from LiveDeck
│   ├── Layout.tsx
│   └── ConfirmDialog.tsx
├── context/
│   └── LiveSessionContext.tsx      # State only — no business rules
├── pages/                          # UI views only — no DAO imports
│   ├── CoachDashboard.tsx
│   ├── SwimmersList.tsx
│   ├── SwimmerDetail.tsx
│   ├── SessionsList.tsx
│   ├── SessionDetail.tsx
│   ├── DrillBank.tsx
│   ├── DrillDetail.tsx
│   ├── LiveDeck.tsx
│   ├── LaneView.tsx
│   └── Settings.tsx
├── utils/
│   ├── lapEditing.ts
│   ├── formatTime.ts
│   └── drillHelpers.ts        # aggregateByStroke, detectFocus, etc.
├── constants/
│   └── drill.ts                # EQUIPMENT_OPTIONS, labels, strokes
├── i18n/
└── sync/
    └── syncEngine.ts
```
