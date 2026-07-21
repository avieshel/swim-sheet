# Quick Start — "Path to Value" for New Users

## Use Case

A coach arrives at the pool with swimmers. They open SwimSheet for the first time. They want to **time one or more swimmers on a drill right now** — no "onboarding" of adding swimmers to a roster or creating a session template first.

The value proposition is: open the app → land directly in the live view with a default drill and temp swimmers → tap Start/Finish → see split times → keep timing. Zero taps to value — no onboarding, no session picker, no setup.

## Problem

Currently, a new user hits two cold-start hurdles to reach the live view:

1. **Roster must be populated** — SessionSetup lists swimmers for lane assignment; empty roster → can't assign
2. **Session template must exist** — "Start Session" is disabled without a selected template

## Goal

A coach opens the app and is immediately in the live view timing a 100m freestyle with default swimmers (Michael Phelps in Lane 1, Katie Ledecky + Caeleb Dressel in Lane 2). Zero friction. Value in under 5 seconds — no taps required.

## Design Decision: Default Session Template

**Key insight**: Instead of making `session_id` nullable on `SessionRun` (which fragments the data model and breaks assumptions in existing code), create a **visible default session template** once, then use the existing `createRunFromTemplate` path. This means:

- `SessionRun.session_id` is always a valid FK — no schema change needed
- All existing `getSession(run.session_id)` calls work — history/review works seamlessly
- `createRunFromTemplate` handles drill snapshotting — no new run-creation logic
- The default template is a singleton, created lazily on first use, visible in the Sessions list like any other session
- Users can edit or delete the default session if they wish
- Results of quick-time sessions are indistinguishable from normal sessions at the data layer — full compatibility

## Design Tenets

- **Existing SessionSetup and full-featured flows are untouched** — returning/advanced users with rosters and templates use the structured path (accessible via `/dashboard` → full session setup)
- **Quick Time is the default entry point** — app opens to `/` (root route → `LiveDeck`) which auto-starts a quick-time session immediately. No picker, no "Start Timing" button — the live view appears directly.
- **Auto-start, not auto-select** — the root route does not show a session picker. If no active run exists, one is created automatically via `handleQuickStart()` (guarded by a `useRef` to fire only once). If an active run exists (e.g. page refresh), it is restored.
- **One schema, two modes** — quick-time and full sessions share the same tables (Session, SessionRun, RunDrill, LaneDrillResult). The only difference is the swimmer data source: virtual (in-memory + notes JSON) vs real (Swimmer + RunSwimmer tables).
- **Serve both personas** — the app is a sophisticated timer for some and a progression tracker for others. Never force one path.
- **Famous swimmer defaults** — temp swimmers use famous swimmer names (Michael Phelps, Katie Ledecky, Caeleb Dressel) to signal "temporary, edit anytime"
- **Multi-swimmer hint** — Lane 2 starts with 2 swimmers to hint that multiple swimmers per lane are supported
- **One-tap scale** — "Add Swimmer" / "Temp Swimmer" buttons grow the session from 3 to N swimmers
- **Inline editing** — drill name/distance/stroke and swimmer names are editable directly in the group card
- **Name edit is the promotion signal** — editing a virtual swimmer's name triggers a non-blocking inline prompt to save to roster. The prompt must never interrupt timing (auto-dismiss, no modal, doesn't block Start/Lap/Finish).
- **Promotion is optional** — coaches can tap × or ignore the prompt. Virtual swimmers remain usable for the session. Their timing data is always preserved in LaneDrillResult blobs regardless of promotion status.

## Roster-Aware Behavior

The Quick Time flow adapts based on how many swimmers the coach has defined in their roster. This prevents the feature from feeling "too simple" as the roster grows.

### Threshold

Define a configurable threshold `T` (default: 5). The behavior changes at the boundary:

| Roster size | Pre-populated swimmers | Add swimmer control | Use case |
|-------------|----------------------|-------------------|----------|
| **0** | 3 virtual (Phelps, Ledecky, Dressel) | "Add Swimmer" / "Temp Swimmer" buttons | Fresh app, no data yet |
| **1 to T-1** | 3 virtual | Dropdown: roster swimmers + "Temp Swimmer" option | Small roster — coach may want to mix real and temp |
| **≥ T** | 0 (empty lanes) | Dropdown: roster swimmers + "Temp Swimmer" option | Established roster — coach almost always picks real swimmers |

### Pre-population Logic

**Roster size 0** (current behavior):
- Lane 1: "Michael Phelps" (1 virtual swimmer)
- Lane 2: "Katie Ledecky" + "Caeleb Dressel" (2 virtual swimmers — hints at multi-swimmer lanes)
- Add button → next famous swimmer name from pool

**Roster size 1 to T-1** (e.g., 1-4 swimmers):
- Same visual — 2 virtual lanes with 3 swimmers
- Add button shows a dropdown menu:
  ```
  [Add Swimmer ▼]
  ├─ Jane Smith (existing)
  ├─ Bob Johnson (existing)
  ├─ ────────────
  └─ Temp Swimmer (set name later)
  ```
- Selecting an existing swimmer: creates a new lane with the real swimmer (uses their UUID as `dbId`, no promotion needed — already real)
- Selecting "Temp Swimmer": creates a virtual swimmer with next famous swimmer name (same behavior as current "Temp Swimmer" button)

**Roster size ≥ T** (e.g., 5+ swimmers):
- No pre-populated virtual swimmers. The live view starts with a prompt:
  ```
  ┌──────────────────────────────────────┐
  │  Select swimmers to time             │
  │                                      │
  │  [Search swimmers...]                │
  │                                      │
  │  ☑ Jane Smith      Lane 1 [1▼]      │
  │  ☐ Bob Johnson     Lane 2 [2▼]      │
  │  ☐ Sarah Lee       Lane 3 [3▼]      │
  │  ☐ ...                               │
  │                                      │
  │  [+ Quick Random]                    │
  │                                      │
  │  [Start Timing]                      │
  └──────────────────────────────────────┘
  ```
- Coach checks swimmers they want to time, assigns lanes
- "Quick Random" adds a virtual swimmer alongside real ones
- "Start Timing" transitions to the full live view with the selected swimmers
- This is essentially the SessionSetup swimmer picker but pre-filtered to the swimmer list (no template or date selection)

### Guess Most Likely Swimmer (≥ T mode)

When roster ≥ T, make the selection faster by pre-selecting likely candidates:

| Signal | What it suggests |
|--------|-----------------|
| Most recent RunSwimmer links | These swimmers were timed recently — likely to be timed again |
| Same day of week / time | Regular practice pattern |
| Default pool length matches settings | Regulars at this pool |

Implementation: query `RunSwimmer` records, group by `swimmer_id`, sort by most recent `createdAt`. Show top 3-5 as pre-selected. Simple and effective.

### Post-Hoc Linking

**Problem**: Coach timed a virtual swimmer (e.g., "Jellyfish Jill") and later realizes that swimmer is already in the roster under a different name (e.g., "Jane Smith"). The timed data needs to be associated with the existing real swimmer.

**Solution**: A "Link to existing swimmer" action on any virtual swimmer card, accessible via:

| Trigger | UX |
|---------|----|
| Long-press on swimmer name | Context menu with "Link to existing swimmer..." |
| "..." menu on the swimmer card | "Link to existing swimmer..." |
| Name edit + search finds match | "Link to existing Jane Smith?" prompt |

The link action opens a swimmer search/selector:

```
┌──────────────────────────────────────┐
│  Link "Jellyfish Jill" to...         │
│                                      │
│  [Search by name...             🔍]  │
│                                      │
│  Jane Smith (U17)                    │
│  Bob Johnson (Senior)                │
│  Sarah Lee (Masters)                 │
│  ...                                 │
│                                      │
│  [Link]  [Cancel]                    │
└──────────────────────────────────────┘
```

When the coach selects a target and confirms, the `promoteAndLinkSwimmer()` procedure runs:
1. No new `Swimmer` created (already exists)
2. `LaneDrillResult` blobs: replace `"quick-..."` with the real UUID
3. `Lap` records: create from saved data with the real UUID
4. `RunSwimmer` link: create
5. Context state: update `dbId` via `UPDATE_SWIMMER_DBID`
6. The virtual swimmer's display name may stay as "Jellyfish Jill" or auto-update to the real name — preference: **auto-update to the real swimmer's name** to avoid confusion

After linking:
- The swimmer card now shows the real name and has a green "Linked" badge
- The synthetic `dbId` is gone — the swimmer is fully real
- All timing data is preserved
- Future sessions: the swimmer appears in the roster picker

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Coach has 3 swimmers but wants to time 2 random ones they don't know | Add dropdown → "Quick Random" → virtual swimmer created alongside the 3 real ones |
| Coach has 20 swimmers, times them all via Quick Time | Each session creates a new SessionRun. No virtual swimmers — all real. Multiple runs accumulate in history. |
| Coach links the same virtual swimmer to two different real swimmers | Not allowed — each virtual swimmer can only link to one real swimmer. The UI enforces this by removing the virtual entry after linking. |
| Coach accidentally links to wrong swimmer | Unlink action: reverse the procedure (delete Lap records, remove RunSwimmer, restore virtual `dbId`). Or just let them re-link to the correct one (delete old Lap/RunSwimmer, create new). |

## Proposed Flow

```
App opens → / (root route → LiveDeck)
  │
  ├─ Active run exists → restore from notes JSON (virtual swimmers grouped by lane)
  │   │                   + RunSwimmer links (real swimmers merged in)
  │   └─ ActiveRunView (resume timing)
  │
  └─ No active run → handleQuickStart() auto-fires (guarded by useRef):
       │
       ├─ 1. createQuickStartRun():
       │      - Find or create the default session template:
       │          Session { name: 'Quick 100m freestyle (default)',
       │                   poolLength: 25, notes: '' }
       │          Drill { name: '100m Freestyle', stroke: 'freestyle',
       │                  distance: 100, order: 0, items: [{ distance: 100,
       │                  stroke: 'freestyle', repeatCount: 1 }],
       │                  timingMode: 'individual' }
       │      - Create SessionRun via createFromTemplate:
       │          session_id: the default template's id
       │          date: today, poolName: 'Quick Time', poolLength: 25,
       │          status: 'active'
       │          notes: JSON { isQuickStart: true, version: 2, virtualSwimmers: [...] }
       │      → RunDrill snapshot created automatically (100m Freestyle)
       │
       ├─ 2. Create virtual swimmers and persist to notes:
       │      - Lane 1: Michael Phelps (1 swimmer — hints at single-swimmer lane)
       │      - Lane 2: Katie Ledecky + Caeleb Dressel (2 swimmers — hints at multi-swimmer)
       │      - Virtual swimmers get dbId: "quick-..."
       │      - updateRun(runId, { notes: JSON with virtualSwimmers })
       │
       ├─ 3. Dispatch INIT_FROM_RUN with groups:
       │      - Lane 1: [Michael Phelps]
       │      - Lane 2: [Katie Ledecky, Caeleb Dressel]
       │      - All groups have currentRunDrillId set to the RunDrill's id
       │
       └─ 4. Renders ActiveRunView:
              Session timer auto-starts →
              Coach sees lane cards (virtual + real) →
              100m Freestyle pre-selected, editable →
              Start/Finish/Lap buttons are live →
              [Add Swimmer] / [Temp Swimmer] buttons per lane →
              Inline editing for swimmer names and drill attributes →
              Name edit → inline promotion chip (non-blocking) →
              Tap Start → time swimmer → tap Finish →
              Record laps, see split times →
              Complete session → LaneDrillResult for all →
              History/review works normally →
              onComplete resets autoStartedRef → next visit auto-starts fresh
```

## Default Temp Swimmer Names

Famous swimmers from `FAMOUS_SWIMMER_NAMES` constant:

```
Michael Phelps       Katie Ledecky       Caeleb Dressel
Ryan Lochte          Missy Franklin      Ian Thorpe
Natalie Coughlin     Sun Yang            Nathan Adrian
Simone Manuel        Lilly King          Adam Peaty
Sarah Sjostrom       Katinka Hosszu      Florent Manaudou
```

On quick-start creation: Lane 1 gets "Michael Phelps" (1 swimmer), Lane 2 gets "Katie Ledecky" + "Caeleb Dressel" (2 swimmers — hints at multi-swimmer lanes). Every tap of "Temp Swimmer" picks the next unused name from the pool.

## Changes Required

### 1. Service — `client/src/services/runService.ts`

**New method**: `getOrCreateDefaultSession(): Promise<string>` — finds or creates the `Quick 100m freestyle (default)` session template with one 100m freestyle drill. Returns the session ID.

```ts
const SESSION_SYSTEM_NAME = 'Quick 100m freestyle (default)'

getOrCreateDefaultSession: async () => {
  // Check if the default session already exists
  const sessions = await getAllSessions()
  const existing = sessions.find(s => s.name === SESSION_SYSTEM_NAME)
  if (existing) return existing.id

  // Create the session template
  const sessionId = await addSession({
    name: SESSION_SYSTEM_NAME,
    poolLength: 25,
    notes: JSON.stringify({ system: true }),
  })

  // Create the default drill (no library insertion — use DAO directly, not addDrill)
  await db.drills.add({
    id: crypto.randomUUID(),
    session_id: sessionId,
    name: '100m Freestyle',
    stroke: 'freestyle',
    distance: 100,
    order: 0,
    items: [{
      id: crypto.randomUUID(),
      distance: 100,
      stroke: 'freestyle',
      repeatCount: 1,
    }],
    repeatCount: 1,
    timingMode: 'individual',
    focus: 'none',
    labels: [],
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  return sessionId
}
```

**Note**: We bypass `addDrill()` here to avoid auto-saving "100m Freestyle" to the library drill bank. The drill goes directly into the `drills` table via `db.drills.add()`.

**New method**: `createQuickStartRun(): Promise<{ runId: string; drillId: string }>`

```ts
createQuickStartRun: async () => {
  const sessionId = await getOrCreateDefaultSession()

  const runId = await createRunFromTemplate(sessionId, {
    date: new Date().toISOString().split('T')[0],
    poolName: 'Quick Time',
    poolLength: 25,
    notes: JSON.stringify({ isQuickStart: true, version: 1 }),
  })

  // Get the first (and only) RunDrill created by createRunFromTemplate
  const drills = await getRunDrillsForRun(runId)
  const drillId = drills[0]?.id

  return { runId, drillId }
}
```

This reuses the existing `createRunFromTemplate` (whether in DAO or moved to service per A-004). The template has one drill, so one RunDrill is created.

### 2. Service — filter system sessions from user-facing lists

In `sessionService.list()`, filter out the system template:

```ts
list: async () => {
  const all = await getAllSessions()
  return all.filter(s => {
    try { return !JSON.parse(s.notes)?.system } catch { return true }
  })
}
```

`getSession(id)` remains unfiltered — used by `ActiveRunView` to show the template name (returns `Quick 100m freestyle (default)` — handled by displaying "Quick Time" instead).

### 3. API — `client/src/api/runs.ts`

```ts
export function createQuickStartRun(): Promise<{ runId: string; drillId: string }> {
  return runService.createQuickStart()
}
```

### 4. LiveDeck — `client/src/pages/LiveDeck.tsx`

**QuickStartLanding component** — rendered when no active run, no `?quick=1` param, and not showing SessionSetup.

**handleQuickStart**:

```ts
let nameIndex = 2 // Salty Sally, Bubbles already used

const pickName = () => {
  const idx = nameIndex++
  if (idx < SEA_CREATURE_NAMES.length) return SEA_CREATURE_NAMES[idx]
  return `Sardine Sid ${idx - SEA_CREATURE_NAMES.length + 2}`
}

const handleQuickStart = async () => {
  setChecking(true)
  const { runId, drillId } = await createQuickStartRun()
  const groups: TimedGroup[] = [
    {
      id: crypto.randomUUID(),
      lane: 1, name: 'Lane 1',
      swimmers: [{
        id: Date.now() + Math.random(),
        dbId: `quick-${Date.now()}`,
        name: 'Salty Sally',
        completed: false,
        lapStrokeCounts: {},
      }],
      currentRunDrillId: drillId,
      drillOverride: null,
    },
    {
      id: crypto.randomUUID(),
      lane: 2, name: 'Lane 2',
      swimmers: [{
        id: Date.now() + 1 + Math.random(),
        dbId: `quick-${Date.now() + 1}`,
        name: 'Bubbles',
        completed: false,
        lapStrokeCounts: {},
      }],
      currentRunDrillId: drillId,
      drillOverride: null,
    },
  ]
  dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId } })
  const run = await getActiveRun()
  setActiveRun(run ?? null)
  setChecking(false)
}
```

**Entry point rendering**:

```tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.has('quick') && !activeRun && !checking) {
    handleQuickStart()
  }
}, [])

if (checking) return <Loading />
if (activeRun) return <QuickTimeRunView ... />
if (showingSetup) return <SessionSetup onStart={...} />
return <QuickStartLanding onQuickStart={handleQuickStart} onFullSetup={() => setShowingSetup(true)} />
```

### 5. ActiveRunView — Session header  

When `templateName === 'Quick 100m freestyle (default)'`, display `"Quick Time"` as the header title instead of the internal name. Detection:

```ts
const templateName = s?.name === 'Quick 100m freestyle (default)' ? 'Quick Time' : (s?.name || 'Session')
```

### 6. Virtual Swimmer Handling

| Operation | Behavior |
|-----------|----------|
| **Start/Finish/Lap** | Work fully — `dbId: "quick-..."` is a valid string for TimestampStore keys |
| **handleCompleteDrill** | Saves to LaneDrillResult blob — `dbId` stored as JSON field, works fine |
| **handleComplete** | **Must skip** virtual swimmers — their `dbId` starts with `"quick-"` (see §8) |
| **Lane Editor** | Virtual swimmers show in lane groups, can coexist with real swimmers |
| **Page refresh** | By default, lost (no RunSwimmer records). Recovery via `notes` JSON (see §10) |

### 7. QuickTimeRunView

Extends `ActiveRunView` with roster-aware features:

**"🐙 Add Swimmer ▼" dropdown** (replaces the simple "Add Random Swimmer" button):

```
[🐙 Add Swimmer ▼]
├─ Jane Smith        ← existing roster swimmer (click to add directly)
├─ Bob Johnson       ← existing roster swimmer
├─ Sarah Lee         ← existing roster swimmer
├─ ────────────
└─ 🐟 Quick Random   ← virtual swimmer with next sea creature name
```

Behavior:
- Selecting a roster swimmer: creates a new lane with the real swimmer's data (UUID as `dbId`, name from DB). No promotion needed — already real.
- Selecting "Quick Random": creates a virtual swimmer with next sea creature name. Works as before.
- Roster list sorted by most-recently-timed first (from `RunSwimmer` records).
- If roster ≥ T, the dropdown shows the picker prompt instead of pre-populated virtual lanes.

**Inline drill editing** — tap drill name/distance/stroke → inputs → dispatch `SET_GROUP_DRILL_OVERRIDE`

**Inline swimmer name editing** — tap name → input → dispatch `RENAME_SWIMMER`, then trigger promotion chip

**Post-hoc linking** — long-press swimmer name or "..." menu → "Link to existing swimmer..." → opens swimmer search/selector → links timed data to existing real swimmer

**Swimmer card context menu** (triggered by long-press or "..." icon):

```
[★ Edit Name]
[🔗 Link to existing swimmer...]
[🗑 Remove from session]
```

**Roster-aware initialization** — `QuickTimeRunView` checks roster size on mount:

```ts
const [rosterSize, setRosterSize] = useState(0)

useEffect(() => {
  listSwimmers().then(all => setRosterSize(all.length))
}, [])

// In handleQuickStart:
const roster = await listSwimmers()
const threshold = 5 // configurable

if (roster.length === 0) {
  // Two virtual swimmers (current default)
} else if (roster.length < threshold) {
  // Two virtual swimmers + roster dropdown
} else {
  // No virtual swimmers — show swimmer picker
  // Pre-select based on most recent RunSwimmer links
}
```

### 8. Context — `LiveSessionContext.tsx`

**New reducer actions**: `RENAME_SWIMMER`, `UPDATE_SWIMMER_DBID`

```ts
| { type: 'RENAME_SWIMMER'; payload: { groupId: string; swimmerId: number; name: string } }
| { type: 'UPDATE_SWIMMER_DBID'; payload: { groupId: string; swimmerId: number; dbId: string } }
```

Implementation:

```ts
case 'RENAME_SWIMMER':
  return {
    ...state,
    groups: state.groups.map(g =>
      g.id === action.payload.groupId
        ? {
            ...g,
            swimmers: g.swimmers.map(s =>
              s.id === action.payload.swimmerId
                ? { ...s, name: action.payload.name }
                : s
            ),
          }
        : g
    ),
  }
```

### 9. CoachDashboard — `client/src/pages/CoachDashboard.tsx`

Accessible at `/dashboard` for the full session setup flow (SessionSetup with template selection, roster assignment, etc.). The dashboard is the "advanced" entry point for coaches with established rosters and templates. The root route `/` is the quick-time entry point — no dashboard needed for the default flow.

### 10. Page Refresh Recovery

On refresh, `LiveDeck` calls `getActiveRun()` → finds the run → calls `getRunSwimmerLinks()` → empty (no RunSwimmer records for virtual swimmers) → builds zero groups.

**Fix**: Parse `SessionRun.notes` for virtual swimmer state:

```json
{
  "isQuickStart": true,
  "version": 1,
  "virtualSwimmers": [
    { "name": "Salty Sally", "dbId": "quick-1718000000000", "lane": 1 },
    { "name": "Bubbles", "dbId": "quick-1718000000001", "lane": 2 }
  ],
  "drillOverrides": [
    { "groupId": "<uuid>", "name": "200m Backstroke", "distance": 200, "stroke": "backstroke" }
  ]
}
```

In the `INIT_FROM_RUN` logic (LiveDeck.tsx lines 814-841):

```ts
if (run) {
  const notes = parseQuickStartNotes(run.notes)

  if (notes?.isQuickStart && notes.virtualSwimmers) {
    const defaultDrillId = (await getRunDrills(run.id))[0]?.id
    const links = await getRunSwimmerLinks(run.id)
    const allSwimmers = await getRunSwimmers(run.id)
    const swimmerMap = new Map(allSwimmers.map(s => [s.id, s]))
    const laneMap = new Map<number, TimedGroup>()
    const groups = notes.virtualSwimmers.map(vs => {
      const g: TimedGroup = {
        id: crypto.randomUUID(),
        lane: vs.lane,
        name: `Lane ${vs.lane}`,
        swimmers: [{
          id: Date.now() + Math.random(),
          dbId: vs.dbId,
          name: vs.name,
          completed: false,
          lapStrokeCounts: {},
        }],
        currentRunDrillId: defaultDrillId ?? null,
        drillOverride: notes.drillOverrides?.find(o => o.groupId === vs.lane.toString()) ?? null,
      }
      laneMap.set(vs.lane, g)
      return g
    })
    // Merge real swimmers added via the Lane Editor / Add Swimmer (stored as RunSwimmer
    // links) into their lanes. Promoting a virtual swimmer strips it from
    // `virtualSwimmers` but persists a RunSwimmer link, so this overlay is what keeps
    // those lanes visible after a reload.
    for (const link of links) {
      let g = laneMap.get(link.lane)
      if (!g) {
        g = { id: crypto.randomUUID(), lane: link.lane, name: `Lane ${link.lane}`, swimmers: [], currentRunDrillId: defaultDrillId ?? null, drillOverride: null }
        laneMap.set(link.lane, g)
        groups.push(g)
      }
      if (!g.swimmers.some(s => s.dbId === link.swimmer_id)) {
        const sw = swimmerMap.get(link.swimmer_id)
        g.swimmers.push({ id: Date.now() + Math.random(), dbId: link.swimmer_id, name: sw?.name || 'Unknown', completed: false, lapStrokeCounts: {} })
      }
    }
    dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId: run.id } })
  } else {
    // Existing path: build from RunSwimmer links
    const links = await getRunSwimmerLinks(run.id)
    // ...
  }
}
```

The `notes` JSON is updated on every `RENAME_SWIMMER`, `ADD_GROUP`, `REMOVE_GROUP`, and `SET_GROUP_DRILL_OVERRIDE` dispatch by writing back to `updateRun(runId, { notes: ... })`. Debounce writes to avoid churning Dexie on rapid edits.

## Data Model Review — Quick Time vs Full Experience

### Schema Compatibility

| Table | Quick Time | Full Experience | Same schema? |
|-------|-----------|----------------|-------------|
| `Session` | `Quick 100m freestyle (default)` (system, hidden) | User-created templates | ✅ Yes |
| `SessionRun` | Created from system template | Created from user template | ✅ Yes |
| `RunDrill` | 1 drill (100m freestyle) | N drills from template | ✅ Yes |
| `RunSwimmer` | None created | 1 per swimmer assigned | ✅ Yes — quick time skips this |
| `LaneDrillResult` | Timing data saved here | Timing data saved here | ✅ Yes |
| `Lap` | Saved for virtual swimmers too | Saved for real swimmers | ✅ Yes — but virtual Laps are orphaned (see below) |
| `Swimmer` | None created | 1 per roster entry | ✅ Yes |
| `Session.notes` | `{ isQuickStart: true, version: 1, virtualSwimmers: [...] }` | User notes | ✅ Yes — JSON key namespace is clean |

**No schema changes needed.** The default session approach avoids making `session_id` nullable.

### The Lap Record Issue (Critical)

`handleComplete` (LiveDeck.tsx:510) iterates all swimmers and saves Lap records for any with a truthy `dbId`. Virtual swimmers have `dbId: "quick-..."` which is truthy, so the loop creates Lap records with `swimmer_id: "quick-..."` — orphan records with no matching Swimmer.

**Fix**: In the `handleComplete` loop, skip swimmers whose `dbId` starts with `"quick-"`:

```ts
for (const swimmer of group.swimmers) {
  if (!swimmer.dbId || swimmer.dbId.startsWith('quick-')) continue
  // existing lap-saving logic
}
```

Their data is already persisted in LaneDrillResult blobs via `handleCompleteDrill`, so nothing is lost.

### Dual Save Path

| Path | When | Writes to | Virtual swimmer safe? |
|------|------|-----------|----------------------|
| `handleCompleteDrill` | All swimmers in a group complete a single drill | `LaneDrillResult` blob | ✅ Yes — `dbId` is just a JSON field |
| `handleComplete` | Coach taps "Complete" on the whole session | `Lap` table | ❌ Without the `"quick-"` guard — orphan records |

**Recommendation**: LaneDrillResult blobs are the universal persistence layer. Lap records are an optimization for per-swimmer queries. For quick-time sessions, the LaneDrillResult blobs are sufficient. The `"quick-"` guard prevents data corruption.

### Virtual Swimmer State Breakdown

| Concern | Current state | Risk | Fix |
|---------|--------------|------|-----|
| TimestampStore keys | Uses `dbId` as key suffix | None — `"quick-..."` is a valid string | None |
| `handleComplete` skip guard | `if (swimmer.dbId)` — truthy for `"quick-"` | **High** — orphan Lap records | Add `!dbId.startsWith('quick-')` check |
| `handleCompleteDrill` save | Saves to LaneDrillResult | None — `dbId` is a JSON field | None |
| Page refresh recovery | Lost — no RunSwimmer records | Medium | Store/restore from `notes` JSON |
| Drill override persistence | `drillOverride` in-memory only | Low | Include in `notes` JSON |  
| Lane Editor display | Virtual swimmers shown in lanes | None | None |
| History/review display | Reads from LaneDrillResult | None — works with any `dbId` | None |

### Graduation Path: Virtual → Real Swimmer

**The core question**: After promoting a virtual swimmer (e.g. "Salty Sally") to a real `Swimmer` record, will their drill times from the quick-time session still be associated with them?

**Short answer**: Yes, but only if the promotion process explicitly migrates three pieces of data:

| Data location | Before promotion | After promotion | Who migrates? |
|--------------|-----------------|----------------|--------------|
| `LaneDrillResult.data.swimmers[].dbId` | `"quick-1718000000000"` | Real UUID `"abc-..."` | Promotion code must rewrite each blob |
| `Lap` table | No records (skipped — see §8) | One `Lap` per recorded lap | Promotion code must create from LaneDrillResult data |
| `RunSwimmer` table | No record | One `RunSwimmer` row linking swimmer → run | Promotion code must create |

If the promotion code does NOT do these three things, here's what breaks:

| If missing | Symptom | Impact |
|-----------|---------|--------|
| LaneDrillResult dbId not updated | History view loads swimmer data from LaneDrillResult but `dbId` doesn't match the real swimmer's UUID. The `SavedSwimmerRow` renders from the JSON (uses name, not dbId), so it **looks correct**. But any query-by-id fails. | **Minor** — display works, queries break |
| Lap records not created | `getLapsForSwimmerInRun(runId, realUuid)` returns empty. SwimmerDetail shows the session in history but can't drill into lap details. The A-012 history/review feature would have no Lap data. | **Major** — per-swimmer drill detail is empty |
| RunSwimmer not created | `getRunsForSwimmer(realUuid)` returns empty. The session doesn't appear in SwimmerDetail's history at all. | **Critical** — swimmer looks like they never participated |

#### The Promotion Signal: Name Edit

**Key insight**: When a coach edits a virtual swimmer's name, that's a strong signal they want that swimmer to be "real." The name edit itself should trigger the promotion flow — not a separate "Save to Roster" button.

The flow on each name edit:

```
Coach taps swimmer name → edits "Salty Sally" → "Jane Smith" → blurs / hits Enter

  1. Search existing Swimmer records for "Jane Smith"
     │
     ├─ Match found (exact or fuzzy):
     │   → Show inline chip: "Linked to existing swimmer Jane Smith (U17)"
     │   → On confirm: run promotion using the existing swimmer's UUID
     │   → On cancel: keep name as display-only, no promotion
     │
     └─ No match found:
         → Show inline chip: "Save Jane Smith to your roster?"
         → On confirm: create Swimmer record + run promotion
         → On "Edit Details": open lightweight form (name, group) then promote
         → On dismiss: keep name as display-only, no promotion
```

**UX — non-blocking inline chip, not a modal**:

When the coach finishes editing a name, a subtle chip appears below the swimmer card:

```
┌──────────────────────────────────────┐
│ Jane Smith                    01:23.4│
│ [▶ Start] [● Lap] [■ Finish]         │
├──────────────────────────────────────┤
│ ✓ Linked to existing swimmer         │
│   Jane Smith (U17)                   │
└──────────────────────────────────────┘

or

┌──────────────────────────────────────┐
│ Jane Smith                    01:23.4│
│ [▶ Start] [● Lap] [■ Finish]         │
├──────────────────────────────────────┤
│ + Save "Jane Smith" to roster?       │
│   [Save] [Edit Details →] [×]        │
└──────────────────────────────────────┘
```

This appears **below** the swimmer card so it doesn't interfere with the Start/Lap/Finish buttons. It's dismissible (×) and non-blocking — the coach can continue timing without responding.

#### When else does promotion trigger?

| Trigger | UX | Timing |
|---------|----|--------|
| **Name edit** (active session) | Inline chip below swimmer card | Immediately after name change |
| **Name edit** (saved/completed drill) | Inline chip on the saved swimmer card | Immediately after name change |
| **"💾 Save" icon** on virtual swimmer card | Same inline chip, searches current name | On tap |
| **"🔗 Link to existing" from context menu** | Opens swimmer search/selector → select target → confirm | On menu selection |
| **Post-session "Complete"** | Summary modal listing all un-promoted virtual swimmers | On session end |

The "Link to existing" flow is for the case where the coach knows the virtual swimmer matches an existing roster entry but under a **different name** (e.g., "Jellyfish Jill" is actually "Jane Smith"). The name edit flow handles the case where the coach types the real name. Both paths converge on `promoteAndLinkSwimmer()`.

The post-session modal catches any virtual swimmers the coach never edited but might want to keep:

```
Session Complete — 4 swimmers timed
  ┌──────────────────────────────────────┐
  │ Save swimmers to your roster?        │
  │                                      │
  │ [✓] Salty Sally         (edited ✓)   │
  │ [✓] Bubbles                          │
  │ [✓] Jellyfish Jill      (edited ✓)   │
  │ [ ] Starfish Steve                   │
  │                                      │
  │         [Save Selected] [Not Now]    │
  └──────────────────────────────────────┘
```

Checked swimmers with edited names are pre-selected. Unedited ones default to unchecked — weaker signal, coach opts in.

#### Implementation: `promoteAndLinkSwimmer()` service method

```ts
/**
 * Promote a virtual swimmer to a real DB swimmer.
 *
 * @param runId - The session run ID
 * @param syntheticDbId - The virtual swimmer's "quick-..." dbId
 * @param name - The name to use (new name, or the virtual swimmer's current name)
 * @param explicitDbId - Optional: if the coach hand-picked an existing swimmer from search,
 *                       pass their UUID here to skip the search-by-name step.
 * @param group - Optional group name for new swimmer creation
 */
async function promoteAndLinkSwimmer(
  runId: string,
  syntheticDbId: string,
  name: string,
  explicitDbId?: string,
  group?: string,
): Promise<string> {
  // Step 1: Determine the real swimmer ID
  let realDbId: string

  if (explicitDbId) {
    // Post-hoc link: coach hand-picked an existing swimmer
    realDbId = explicitDbId
  } else {
    // Name-edit trigger: search by name, then create or link
    const existing = await searchSwimmers(name)
    if (existing.length > 0) {
      realDbId = existing[0].id  // Link to first match
    } else {
      realDbId = await createSwimmer({
        name, group: group ?? '', notes: '', status: 'active',
      })
    }
  }

  // Step 2: Rewrite LaneDrillResult blobs
  const results = await getLaneDrillResults(runId)
  for (const result of results) {
    const data = JSON.parse(result.data)
    const swimmerEntry = data.swimmers.find(
      (s: { dbId: string }) => s.dbId === syntheticDbId
    )
    if (swimmerEntry) {
      swimmerEntry.dbId = realDbId
      await setLaneDrillResult({ ...result, data: JSON.stringify(data) })
    }
  }

  // Step 3: Create Lap records from saved data
  for (const result of results) {
    const data = JSON.parse(result.data)
    const swimmerEntry = data.swimmers.find(
      (s: { dbId: string }) => s.dbId === realDbId
    )
    if (swimmerEntry && swimmerEntry.laps) {
      for (const lap of swimmerEntry.laps) {
        await addLap({
          run_drill_id: result.run_drill_id,
          swimmer_id: realDbId,
          time: lap.time / 1000,
          stroke_count: lap.strokeCount ?? 0,
          effort: '',
          notes: '',
        })
      }
    }
  }

  // Step 4: Create RunSwimmer link
  const notes = await getRunNotes(runId)
  const virtualSwimmer = notes?.virtualSwimmers?.find(
    (vs: any) => vs.dbId === syntheticDbId
  )
  await addSwimmerToRun(runId, realDbId, virtualSwimmer?.lane ?? 1)

  // Step 5: Update notes JSON — remove this virtual swimmer
  if (notes?.virtualSwimmers) {
    notes.virtualSwimmers = notes.virtualSwimmers.filter(
      (vs: any) => vs.dbId !== syntheticDbId
    )
    await updateSessionRun(runId, { notes: JSON.stringify(notes) })
  }

  return realDbId
}
```

#### What this means for the in-memory state

When the name edit triggers promotion and the coach accepts, the swimmer's `dbId` in the context state needs to change from `"quick-..."` to the real UUID. Options:

1. **Replace the swimmer** — dispatch `REMOVE_SWIMMER` then `ADD_SWIMMER` with the real dbId. Resets `completed` and `lapStrokeCounts` (undesirable — loses in-session state).

2. **New reducer action `UPDATE_SWIMMER_DBID`** — changes only the `dbId` field without affecting timing state:

```ts
| { type: 'UPDATE_SWIMMER_DBID'; payload: { groupId: string; swimmerId: number; dbId: string } }
```

```ts
case 'UPDATE_SWIMMER_DBID':
  return {
    ...state,
    groups: state.groups.map(g =>
      g.id === action.payload.groupId
        ? {
            ...g,
            swimmers: g.swimmers.map(s =>
              s.id === action.payload.swimmerId
                ? { ...s, dbId: action.payload.dbId }
                : s
            ),
          }
        : g
    ),
  }
```

This keeps the swimmer's position, completed state, and lapStrokeCounts intact — only the `dbId` changes.

#### Summary: Can the coach edit names and have times follow?

| If coach does this... | Data migration needed? | Times follow? |
|---|---|---|
| Edits name → confirms "link to existing" | ✅ Promotion runs (LaneDrillResult + Lap + RunSwimmer) | ✅ Fully linked |
| Edits name → confirms "create new" | ✅ Promotion runs | ✅ Fully linked |
| Edits name → dismisses the chip | ❌ No promotion — display name only | ✅ Display shows name, but `SwimmerDetail` is empty |
| Never edits names → completes session | ❌ No promotion | ✅ Display from LaneDrillResult, no DB records |
| Never edits names → post-session "Save Selected" | ✅ Promotion runs for each checked swimmer | ✅ Fully linked |

**The data model fully supports this.** The promotion procedure is the bridge that converts ephemeral virtual swimmers into permanent DB records with all timing data intact. Without it, the display works (LaneDrillResult blobs are self-contained) but the swimmer doesn't appear in `SwimmerDetail` or any DB-backed query.

#### What existing code breaks without promotion?

| Code path | Without promotion | After promotion |
|-----------|-----------------|----------------|
| SwimmerDetail session history | Empty (no RunSwimmer) | ✅ Shows session |
| SwimmerDetail lap drill-down | Empty (no Lap records) | ✅ Shows laps |
| SavedSwimmerRow in history view | ✅ Works (reads from LaneDrillResult, uses `name` not `dbId`) | ✅ Works (same path) |
| Session header template name | Shows `Quick 100m freestyle (default)` | Display as "Quick Time" |
| Data export | Virtual swimmer has no export | ✅ Real swimmer exports normally |

**The display path already works** — `SavedSwimmerRow` renders from `LaneDrillResult.data` which stores swimmer names directly. The two broken paths (`SwimmerDetail` history + lap drill-down) are only fixed by promotion.

### History/Review (A-012) Compatibility

The history view reads `LaneDrillResult` data for timing display. The only difference between quick-time and full sessions in history:

| Aspect | Quick Time | Full Session |
|--------|-----------|-------------|
| Session name | "Quick Time" | User-defined template name |
| Swimmer names | From `LaneDrillResult.data.swimmers[].name` | From `Swimmer` table (or LaneDrillResult fallback) |
| Lap times | From `LaneDrillResult.data.swimmers[].laps` | From `Lap` table (or LaneDrillResult fallback) |
| Drill name | "100m Freestyle" (or edited name) | Template drill name |

The history view should prefer `LaneDrillResult` data when available (it already does for saved drills via `SavedSwimmerRow`). No changes needed.

### Flow Review — Streamlined vs Clunky

### Two Personas

| Persona | Goal | Relationship with swimmers |
|---------|------|--------------------------|
| **A — "Just the timer"** | Time splits quickly, read them aloud, go home. The app is a sophisticated stopwatch. | Never creates swimmers. Uses the app session-to-session with zero setup. |
| **B — "Build the roster"** | Convert quick timing into long-term tracking. Wants swimmer history. | Will gradually promote virtual swimmers to real ones. Eventually uses full features. |

The flow must serve both without compromising either.

### Step-by-Step Walkthrough

#### Session 1 — Both personas identical

| Step | Action | UX | Streamlined? |
|------|--------|----|-------------|
| 1 | Open app → `/` auto-starts | Live view appears immediately — no dashboard, no picker, no taps. Creates session + drill + 3 virtual swimmers. Transition is instant. | ✅ Zero taps to value |
| 2 | See live view | Two lane cards: Lane 1 has "Michael Phelps", Lane 2 has "Katie Ledecky" + "Caeleb Dressel". 100m Freestyle pre-selected. Timer running. | ✅ Zero-config timing surface |
| 3 | See live view | Two lane cards: "Michael Phelps" (Lane 1), "Katie Ledecky" + "Caeleb Dressel" (Lane 2). 100m Freestyle pre-selected. Timer running. | ✅ Zero-config timing surface |
| 4 | Want more swimmers | Tap "🐙 Add Random Swimmer" → new lane appears with next sea creature name, drill auto-selected | ✅ One tap per swimmer |
| 5 | All swimmers lined up | Each lane shows Start/Lap/Finish buttons. Lane-level Start starts all swimmers in that lane simultaneously. | ✅ Start timing immediately |
| 6 | Recording times | Swimmer-level Start / Lap / Finish record timestamps. Timer displays live. | ✅ Core value delivered |
| 7a | Reads times aloud | Lap splits and final times render live on each card. | ✅ Readable at a glance |
| 7b | Clears and times again | Complete drill → data saved to LaneDrillResult → group resets. Drill stays selected. | ✅ One tap to reset |
| 8 | Done for the day | Tap "Complete" → data persisted. Returns to QuickStartLanding. | ✅ |

**Session 1 score**: 8/8 steps streamlined. Zero friction. Both personas are happy.

#### Session 2 — Persona A diverges from Persona B

**Persona A (just the timer):**
- Opens app, sees fresh Michael Phelps, Katie Ledecky, and Caeleb Dressel
- Never edits names (uses them as-is for identification)
- Never sees a promotion prompt
- Times, completes, leaves
- ✅ Still streamlined — 0 interruptions

**Persona B (wants to track):**
- Opens app, sees Michael Phelps, Katie Ledecky, and Caeleb Dressel
- Recognizes that "Swimmer 1" is actually Jane Smith
- **Taps name → edits "Michael Phelps" → "Jane Smith" → blurs**

**THIS IS THE CRITICAL MOMENT.** The promotion chip appears:

```
┌──────────────────────────────────────┐
│ Jane Smith                    00:32.1│
│ [▶Start] [●Lap] [■Finish]           │
├──────────────────────────────────────┤
│ + Save "Jane Smith" to your roster?  │
│   [Save] [Edit Details →] [×]        │
└──────────────────────────────────────┘
```

| Aspect | Rating | Why |
|--------|--------|-----|
| Visibility | ✅ | Below the card, doesn't overlap controls |
| Blocking | ✅ | Non-blocking — Start/Lap/Finish still work |
| Auto-dismiss | ✅ | Disappears after 5s if ignored |
| Decision load | ⚠️ | Three options: Save / Edit Details / Dismiss |

**Risk for Persona A**: If they edit names for display purposes (e.g. "Salty Sally" → "Lane 1 kid"), the prompt appears. They tap × or ignore it. Fine once. But if they do this every session, it's repetitive.

**Mitigation**: Add "Don't ask again this session" as a small link next to [×]. Once dismissed, no more prompts for that session. A future "Settings → Quick Time → Suppress promotion prompts" toggle for power users who never want to see it.

#### Session 2 continued — Persona B taps "Save"

| Step | Action | UX |
|------|--------|----|
| 9 | Taps [Save] | `promoteAndLinkSwimmer()` runs silently. Chip updates to green: "✓ Saved to roster" |
| 10 | Clicks Add Random Swimmer for the second lane | "Bubbles" appears. Edits → "Sarah" → sees chip again — this time it shows "+ Save 'Sarah' to your roster?" because no match found in DB |
| 11 | Saves Sarah too | Both swimmers now real. Their times for this drill are in LaneDrillResult + Lap table + RunSwimmer link. |
| 12 | Looks at Swimmers page | Sees Jane Smith and Sarah with their names, groups empty. Can edit to add group "U17" later. |
| 13 | Session History | The quick-time session shows in their history with correct times. |

**Session 2 score for Persona B**: 2 promotion chips (non-blocking, auto-dismiss). Acceptable friction for the value gained.

#### Session 5 — Persona B's roster is growing

Now Persona B has 8 real swimmers in the roster. They open the app:

| Step | Action | UX |
|------|--------|----|
| 14 | Open app | Sees Michael Phelps, Katie Ledecky, Caeleb Dressel. But they already have real swimmers. |
| 15 | Tap Lane Editor | Unassigned pool shows all 8 real swimmers. Assign Jane Smith to Lane 1, Sarah to Lane 2 instead of using virtual ones. |
| 16a | OR: Quickly edit virtual names → prompt → "Link to existing?" | Even faster: edit "Michael Phelps" → "Jane" → search finds match → "Link to existing Jane Smith (U17)?" |

**Clunkiness detected**: By session 5, Persona B would benefit from Quick Time recognizing their existing roster and **offering real swimmers first**, not requiring them to go through the Lane Editor or name-edit dance.

**Recommendation**: After the first promotion, Quick Time should pre-populate the Lane Editor with recently-used real swimmers as quick-add options. Or show a hybrid: 2 virtual lanes + a "Pick from roster" bar above the Add Random Swimmer button.

For now this is a future enhancement — the current flow works, just with an extra tap (Lane Editor).

#### Session 10 — Persona B graduates to full setup

Persona B now has a full roster and session templates. They notice the "Quick Start Live" button on the dashboard goes to SessionSetup where they can pick a template and assign real swimmers to lanes. They try it. They now use both modes:

| Mode | When |
|------|------|
| **Quick Time** | Impromptu timing, new swimmers, quick drills — root route `/` |
| **SessionSetup** | Planned workouts with structured drills and known roster |

**This is the ideal outcome.** Quick Time was the gateway. The coach discovered the full features organically.

### Clunkiness Summary

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | Promotion chip has 3 options (Save/Edit Details/×) | Minor — small decision load | Make it two buttons: [Save] [×]. "Edit Details" can be a small link. |
| 2 | Persona A sees promotion chip if they edit names for display | Medium — could annoy power users who edit names but never want to save | Add "Don't ask again this session" link on the chip. Add permanent suppression toggle in Settings. |
| 3 | Persona B by session 5 has real swimmers but Quick Time still shows virtual ones first | Medium — extra step to assign real swimmers | Future: show "recent real swimmers" as quick-add chips in the header alongside "Add Random Swimmer" |
| 4 | Post-session modal appears even if no swimmers were timed | Low — edge case (empty lane, never started) | Only show if there are completed swimmers with timing data |
| 5 | Name edit during timing requires a precise tap on the name text | Low — small hit target on mobile | Make the entire name area of the header tappable (not just the text) |

### Overall Verdict

**Streamlined**: 9/10. Session 1 is pure value — no friction at all. The promotion prompt on name edit is the only moment of decision, and it's non-blocking with auto-dismiss. Persona A can ignore it entirely. Persona B gets a smooth path from "funny name" to "real swimmer with history."

**The critical design rule**: The promotion prompt must never feel like a tax on timing. If the coach is mid-session, focused on the stopwatch, a flashing modal would break flow. The inline chip below the card with auto-dismiss is the right trade-off — visible when they want it, invisible when they don't.

- Default `Quick 100m freestyle (default)` session template: will sync to server — acceptable
- Quick-time `SessionRun`: will sync — `session_id` is a valid FK, server needs to handle the system template or ignore it
- Virtual swimmers don't sync (no `Swimmer` or `RunSwimmer` records) — acceptable, they're ephemeral
- `LaneDrillResult` is client-only — doesn't sync (already the case)

## Implementation Order

1. **Service**: `getOrCreateDefaultSession()` + `createQuickStartRun()` → `runService.ts`
2. **Service**: Filter system sessions in `sessionService.list()`
3. **Service**: `promoteAndLinkSwimmer()` → `runService.ts` (used by both promotion chip + post-hoc link)
4. **API**: `createQuickStartRun()` → `runs.ts`
5. **Reducer**: `RENAME_SWIMMER` + `UPDATE_SWIMMER_DBID` actions → `LiveSessionContext.tsx`
6. **LiveDeck**: `handleQuickStart` (roster-aware) + auto-start on root route `/` (guarded by `useRef`) + `handleComplete` skip guard + page refresh recovery via `notes` JSON parsing (virtual swimmers grouped by lane)
7. **LiveDeck**: Page refresh recovery via `notes` JSON parsing
8. **LiveDeck**: `QuickTimeRunView` — Add Swimmer dropdown (roster + random), inline name/drill editing, swimmer card context menu ("Link to existing..."), promotion chip UI
9. **CoachDashboard**: Accessible at `/dashboard` for full session setup (SessionSetup flow)
10. **Constants**: `FAMOUS_SWIMMER_NAMES` array (31 famous swimmer names)
11. **Post-session prompt**: Summary modal listing un-promoted virtual swimmers on session complete

## Verification

1. Fresh app → opens to `/` → auto-starts quick time session (no picker, no taps)
2. Lands immediately in live view with "Michael Phelps" (Lane 1) and "Katie Ledecky" + "Caeleb Dressel" (Lane 2)
3. 100m Freestyle pre-selected, Start/Finish is live
4. Tap Start → time swimmer → Finish → lap recording works
5. Tap "Add Swimmer" / "Temp Swimmer" → new swimmer added to lane
6. Select a roster swimmer → real swimmer in lane with UUID dbId (no promotion needed)
7. Tap swimmer name → inline edit → name changes → promotion chip appears below card
8. Accept promotion chip → `promoteAndLinkSwimmer()` runs → chip turns green "✓ Saved"
9. Dismiss promotion chip → name stays in display state only (no DB changes)
10. "Don't ask again this session" link → no further prompts for remaining session
11. Long-press swimmer name → context menu → "Link to existing swimmer..." → search selector → links to existing real swimmer under different name
12. Tap drill name/distance → inline edit → drill override applied
13. Roster with ≥5 swimmers → still auto-starts (roster-aware picker is a future enhancement)
14. Roster with 0 swimmers → 3 virtual swimmers as before
15. Complete session → data saved to LaneDrillResult — no orphan Lap records
16. History/review shows the session with swimmer names and times
17. Sessions list shows "Quick 100m freestyle (default)" as a regular session (user can delete it)
18. Existing SessionSetup flow still works (regression — accessible via `/dashboard`)
19. Page refresh during quick-time → active run restored with virtual swimmers grouped by lane (from `notes` JSON)
20. Page refresh after completing a quick-time drill → LaneDrillResult data persists
21. After completing a session, reopening `/` auto-starts a fresh quick-time session
