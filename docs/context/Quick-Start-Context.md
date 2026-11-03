# Quick Start — "Path to Value" for New Users

## Use Case

A coach arrives at the pool with swimmers. They open SwimSheet for the first time. They want to **time one or more swimmers on a drill right now** — no "onboarding" of adding swimmers to a roster or creating a session template first.

The value proposition is: open the app → meet the Live picker with the **"100m freestyle quick time"** option up front → one tap → land in the live view with a default drill and temp swimmers → tap Start/Finish → see split times → keep timing. One tap to value — no onboarding, no roster setup, no template creation.

This doc is maintained **current-state**: it describes how quick start works today (the LiveDeck picker flow), plus the permanent design decisions and the promotion/graduation data-migration analysis. Proposal-era framing has been trimmed.

## Design Tenets

- **The Live picker is always shown — never auto-start** — the root route `/` (and `/live`) renders `LiveDeck`. The picker always lists the pinned **"100m freestyle quick time"** card first, then session templates ranked by **usage** (runs per template, then most-recently-used, then newest first). It never auto-creates a run (the historical "every return to the Live tab starts an accidental session" defect is gone by design).
- **Pick, then time** — selecting quick time or a template starts a live run. If an active run already exists (e.g. page refresh), it is restored instead of creating a new one.
- **One schema, two modes** — quick-time and full sessions share the same tables (Session, SessionRun, RunDrill, LaneDrillResult; schema is camelCase since Dexie v6, `DB_SCHEMA_VERSION = 8`). The only difference is the swimmer data source: virtual (in-memory + run notes JSON) vs real (Swimmer + RunSwimmer tables).
- **Serve both personas** — the app is a sophisticated timer for some and a progression tracker for others. Never force one path. The full setup flows stay first-class (`/dashboard`, `/sessions`, `/drills`).
- **Default 2 lanes, not 8** — sessions start with 2 lanes (up to 8 are supported); lanes sit side by side on wide screens and stack on mobile.
- **One-tap scale** — add-swimmer controls grow the session from 3 to N swimmers.
- **Inline editing** — drill name/distance/stroke and swimmer names are editable directly in the live view.
- **Name edit is the promotion signal** — editing a virtual swimmer's name triggers a non-blocking save/roster affordance. It must never interrupt timing (doesn't block Start/Lap/Finish).
- **Promotion is optional (during the session)** — coaches can ignore the prompt; the virtual swimmer stays usable all session and its timing data is preserved in `LaneDrillResult` blobs. At **session completion**, an unpromoted guest that the coach skips is **discarded** (its times are removed); only promoted (or real roster) swimmers persist to history. See Main-Flow.md "Post-session completion".

## Current Flow (LiveDeck)

```
App opens → / (root route → LiveDeck)
  │
  ├─ Active run exists → restore it:
  │      parse run notes JSON ({ isQuickStart, version: 2, virtualSwimmers }),
  │      rebuild lane groups from virtualSwimmers (lane defaults to the run's
  │      first RunDrill), then merge real swimmers overlayed from RunSwimmer
  │      links — promoting a temp swimmer strips it from virtualSwimmers but
  │      persists a RunSwimmer link, so the merge is what keeps promoted
  │      swimmers visible after a reload
  │   └─ ActiveRunView (resume timing)
  │
  └─ No active run → Live picker:
       ├─ Pinned "100m freestyle quick time" card → handleQuickStart():
       │     1. createQuickStartRun() — find-or-create the default template
       │        by name (below), then createRunFromTemplate → SessionRun +
       │        one RunDrill (snapshot of 100m Freestyle)
       │     2. buildStartLanes(drillId, { prefillTempSwimmers: true }) —
       │        2 lanes; temp swimmers only while the roster is empty
       │     3. persist notes { isQuickStart: true, version: 2,
       │        virtualSwimmers } on the run
       │     4. dispatch INIT_FROM_RUN → ActiveRunView; the temp-swimmers
       │        notice modal shows if prefills were added
       │
       └─ Template card → startLiveSession(session) (useStartLiveSession:
             same createRunFromTemplate → buildStartLanes path, with
             prefillTempSwimmers true ONLY when the session is the default
             quick session; every other template opens 2 empty lanes;
             notes { isQuickStart: false, version: 2, virtualSwimmers })
```

The same start flow serves both the Live picker and the Sessions view — one code path (`hooks/useStartLiveSession.ts` + `api/runSetup.ts` `buildStartLanes`), so every entry point behaves identically.

## The Default Session Template

**Decision**: instead of making `session_id` nullable on `SessionRun`, a visible default session template is created lazily on first quick start and used through the existing `createRunFromTemplate` path:

- `SessionRun.session_id` is always a valid FK — no schema change needed
- history/review works seamlessly; quick-time runs are indistinguishable from normal runs at the data layer
- `createRunFromTemplate` handles drill snapshotting — no special run-creation logic

The template is named `Quick 100m freestyle (default)` and is **found/created by name** (`DEFAULT_QUICK_SESSION_NAME` in `hooks/useStartLiveSession.ts`; the same constant is checked in `services/runService.ts` `createQuickStartRun`). There is **no** `notes {system:true}` JSON flag and no hidden filtering — it is an ordinary session:

- It contains one 100m Freestyle drill (snapshot: 100m freestyle ×1, individual reps)
- It appears in the Sessions list like any other template — **the user can delete it** (`deleteSession(id, { force })`; deleted starter templates are recorded as dismissed via `markSeedSessionDismissed` so they stay deleted)
- On the live run header the internal name is displayed "Quick Time"

Live UI today: `pages/LiveDeck.tsx` (picker) + `pages/live/ActiveRunView.tsx` with `components/live/{LiveSessionHeader, DrillsSection, LaneSwimmersSection, BreakoutHeader}`. There is no separate dedicated quick-time run view — quick time lands in the same `ActiveRunView`.

## Roster-Aware Pre-Population

Temp (hint) swimmers are pre-populated only for the default quick session, and only while the real roster is **empty** (0 swimmers) — checked at start time in `buildStartLanes` via `getSwimmerCount()`.

| Roster size | Pre-populated lanes/swimmers | Add swimmer control | Use case |
|-------------|------------------------------|-------------------|----------|
| **0** | 2 lanes — Lane 1: 2 temp swimmers, Lane 2: 1 temp swimmer + a notice modal (they can be removed now or swapped for real swimmers later) | Add swimmer controls | Fresh app, no data yet |
| **≥ 1** | 2 **empty** lanes (no hint swimmers, no modal) | Roster picker | Coach has a roster — they pick the real swimmers |

- **Temp names come from `FAMOUS_SWIMMER_NAMES`** (`client/src/constants/index.ts`, exposed through `api/constants.ts`): the roster-empty prefill uses the first three names in order; every additional add picks from the pool. Famous-swimmer names signal "temporary, edit anytime".
- Roster ≥ 1 mode leaves the two lanes empty; the coach assigns real swimmers via the lane controls. A pre-filtered "select swimmers to time" picker (search, per-swimmer lane assignment) remains a future enhancement; so does pre-selecting likely candidates (recent `RunSwimmer` links, same day/time pattern, pool settings match — query `RunSwimmer` grouped by `swimmer_id`, most recent first, top 3–5 pre-selected).

| Scenario | Behavior |
|----------|----------|
| Coach has real swimmers but wants 1–2 unprompted extra | Add control creates a temp (virtual) swimmer alongside the real ones |
| Coach times the whole roster | All real swimmers — no virtual entries; runs accumulate in history |
| Linking the same virtual swimmer twice | Not allowed — after linking, the virtual entry is removed by the UI |

## Virtual Swimmer Lifecycle

Virtual swimmers carry `dbId: "quick-..."` (a synthetic id — valid for `TimestampStore` keys) and live only in context state plus the run `notes` JSON. There is no per-group drill override in the model: `TimedGroup = { id, lane, name, swimmers, currentRunDrillId }` (`context/LiveSessionContext.tsx`), and per-lane drill selection uses the `SET_GROUP_DRILL` / `SET_ALL_DRILLS` dispatches against real `RunDrill` rows.

| Concern | Current state |
|---------|--------------|
| Start/Lap/Finish | Work fully — the synthetic `dbId` is a valid timestamp key |
| Drill completion (`handleCompleteDrill`) | Saves to `LaneDrillResult.data` blob — `dbId` is a JSON field, works fine |
| Session completion (`handleComplete`) | Resolves guest (`quick-*`) swimmers: those with recorded times are offered promotion (`promoteAndLinkSwimmer`) or discard (`discardTempSwimmer`); only valid results are saved, and an empty/all-guest session is discarded after a warning (see Main-Flow.md) |
| Lane display | Virtual swimmers render in lane rows, can coexist with real swimmers |
| History/review | Reads from `LaneDrillResult` (blob embeds name + laps) — works with any `dbId` |
| Page refresh | Recovered from run `notes` JSON + `RunSwimmer` overlay (see flow above) |

### Dual Save Path

| Path | When | Writes to | Virtual swimmer safe? |
|------|------|-----------|----------------------|
| `handleCompleteDrill` | Lane completes a drill | `LaneDrillResult` blob | ✅ `dbId` is just a JSON field |
| `handleComplete` | Coach completes the session | `Lap` table | ✅ Guests are skipped in the Lap loop; promoted guests are re-pointed to a real `dbId`, skipped guests are discarded — no orphans |

### The Lap-Orphan Rule (resolved)

Historically `handleComplete` saved a `Lap` row for every swimmer with a truthy `dbId`, which for virtual swimmers (`quick-...`) produced orphan Lap rows pointing at no `Swimmer` record. The rule now: **virtual swimmers are excluded from the Lap loop**, and the post-session completion flow resolves each guest explicitly:

- **Promoted guests** → `promoteAndLinkSwimmer()` re-points/creates their Lap rows under the real roster `dbId` — no orphans.
- **Skipped guests** → `discardTempSwimmer()` removes their `LaneDrillResult` data — nothing lingers in history.

```ts
for (const swimmer of group.swimmers) {
  if (!swimmer.dbId || swimmer.dbId.startsWith('quick-')) continue
  // lap-saving logic (valid swimmers only)
}
```

`LaneDrillResult` blobs are the universal persistence layer; `Lap` records are the per-swimmer query optimization. For quick-time sessions the blobs are sufficient, and the `quick-` guard + completion promote/discard flow prevents data corruption.

## Post-Hoc Linking and Promotion

Semantics implemented in `services/runService.ts` (`promoteAndLinkSwimmer`, `discardTempSwimmer`, exposed via `api/runs.ts`):

| Trigger | UX | Path |
|---------|----|------|
| Name edit + save | Swimmer row affordance (edit name → the save/edit prompt) | `RENAME_SWIMMER` dispatch (name only, in-session state), then on save `promoteAndLinkSwimmer` |
| "Save to roster" on a virtual row | Direct promote with the current name | `promoteAndLinkSwimmer(runId, syntheticDbId, name, undefined, group)` |
| Link to an existing roster swimmer under a different name | Edit/rename to the real name, then the save prompt links to the match | `promoteAndLinkSwimmer(..., explicitDbId)` — skips name search |
| Post-session "Complete" | `BatchPromotionModal` for every guest that recorded times: promote (kept) or skip (discarded) | promote → `promoteAndLinkSwimmer`; skip → `discardTempSwimmer` |

What promotion must migrate — the data-migration analysis that justifies the design (all three steps are required; each is verified against `runService.promoteAndLinkSwimmer`):

| Data location | Before promotion | After promotion | Who migrates? |
|--------------|-----------------|----------------|--------------|
| `LaneDrillResult.data.swimmers[].dbId` | `"quick-1718000000000"` | Real UUID | Promotion code rewrites each blob |
| `Lap` table | No records (skipped) | One `Lap` per recorded lap, re-pointed to the real UUID | Promotion code recreates from saved blob data |
| `RunSwimmer` table | No record | One row linking swimmer → run | Promotion code creates it |

If any step were absent:

| If missing | Symptom | Impact |
|-----------|---------|--------|
| LaneDrillResult dbId not updated | History view renders from the blob (`SavedSwimmerRow` uses name, not dbId) so it *looks* correct, but query-by-id fails | Minor |
| Lap records not created | `getLapsForSwimmerInRun` empty — no lap drill-down | Major |
| RunSwimmer not created | `getRunsForSwimmer` empty — the session never appears in the swimmer's history | Critical |

In-memory transition: promotion dispatches **`UPDATE_SWIMMER_DBID`** (`LiveSessionContext.tsx`) — changes only the `dbId` field, leaving position, `completed`, and `lapStrokeCounts` intact. The alternative (REMOVE + ADD with the real id) would discard in-session state and is rejected — that is why `UPDATE_SWIMMER_DBID` exists alongside plain `RENAME_SWIMMER`.

After linking: the swimmer card shows the real name, the synthetic `dbId` is gone, all timing data is preserved, and the swimmer appears in the roster picker for future sessions.

## Graduation-Summary Matrix

| If coach does this... | Data migration needed? | Times follow? |
|---|---|---|
| Edits name → confirms "link to existing" | ✅ Promotion runs (LaneDrillResult + Lap + RunSwimmer) | ✅ Fully linked |
| Edits name → confirms "create new" | ✅ Promotion runs | ✅ Fully linked |
| Edits name → dismisses without saving | ❌ No promotion — display name only | ✅ Blob display works, but `SwimmerDetail` stays empty for that run |
| Never edits names → completes session and skips guests | ❌ No promotion | — Skipped guests are **discarded** at completion; nothing persists |
| Never edits names → post-session "Promote" | ✅ Promotion runs for each checked swimmer | ✅ Fully linked |

## History/Review Compatibility

The history view reads `LaneDrillResult` data for timing display. Quick-time vs full sessions differ only in the swimmer-name source (blob vs `Swimmer` table); runs frozen under `DB_SCHEMA_VERSION >= 8` carry `sessionName` + a full `SessionSnapshot`, so history renders independently of whether the template still exists. No special case for quick time.

## Sync Notes

- The default quick session template is a client-side convenience row; starter-template seeding/resurfacing is governed by `catalogKey` reconciliation (seeded catalog templates are matched by `catalogKey`, and a deleted starter is recorded dismissed rather than re-seeded on the next sync/refresh). No separate "quick time sync" pathway exists anymore — template and run rows go through the ordinary sync tables.
- Virtual swimmers never sync (no `Swimmer`/`RunSwimmer` records until promoted) — acceptable; they are ephemeral. `LaneDrillResult` blobs are the durable record of a guest's times.

## Known Open Enhancements

| # | Gap | Notes / direction |
|---|-----|-------------------|
| 1 | Promotion prompt carries three options (save / edit details / dismiss) — a small decision load | Consider two buttons; make "edit details" a link |
| 2 | Coaches who rename virtual swimmers for labeling only see the roster-save prompt every time | "Don't ask again this session" link on the prompt; optional Settings suppression |
| 3 | By session ~5 a growing roster is not surfaced in quick start — the coach must assign swimmers explicitly | Quick-add chips of recently-timed real swimmers in the picker/run header |
| 4 | Roster ≥ 1 "select swimmers to time" picker and likely-swimmer pre-selection not built | See "Roster-Aware Pre-Population" |
| 5 | Post-session modal may appear without any recorded times | Gate it on completed swimmers with timing data |
| 6 | Name-edit hit target is small on mobile | Make the whole name area tappable |

## Verification Checklist

Statuses marked by an audit against the code (`LiveDeck.tsx`, `useStartLiveSession.ts`, `runSetup.ts`, `LiveSessionContext.tsx`, `SwimmerRows.tsx`, `ActiveRunView.tsx`).

| # | Item | Status |
|---|------|--------|
| 1 | Fresh app → opens to `/` → Live picker (no auto-start); quick-time card present alongside any templates | ✅ verified |
| 2 | Quick time with 0 swimmers → live view with temp swimmers (2 in Lane 1, 1 in Lane 2) + notice modal | ✅ verified |
| 3 | 100m Freestyle pre-selected; timer controls live | ✅ verified |
| 4 | Start → time → Finish → lap recording works | ✅ verified |
| 5 | Add-swimmer controls add swimmers to lanes | ✅ verified |
| 6 | Selecting a roster swimmer creates a real swimmer row (UUID dbId, no promotion needed) | ✅ verified |
| 7 | Swimmer name inline edit → rename dispatch; save affordance appears | ✅ verified |
| 8 | Accepting the save affordance runs `promoteAndLinkSwimmer` | ✅ verified |
| 9 | Dismissing the save affordance keeps the name display-only (no DB changes) | ✅ verified |
| 10 | "Don't ask again this session" suppression link | ❌ not implemented (open enhancement) |
| 11 | Set drill per lane / all lanes via `SET_GROUP_DRILL` / `SET_ALL_DRILLS` | ✅ verified |
| 12 | Roster ≥ 1 swimmer → quick time starts with 2 empty lanes (no temp hints, no modal) | ✅ verified |
| 13 | Roster = 0 → 3 temp swimmers + notice modal | ✅ verified |
| 14 | Session completion saves `LaneDrillResult`; no orphan `Lap` records for guests | ✅ verified |
| 15 | History/review shows the session with swimmer names and times | ✅ verified |
| 16 | Sessions list shows "Quick 100m freestyle (default)" as a regular session; the user can delete it (and it stays deleted) | ✅ verified — `deleteSession(id, { force })` + `markSeedSessionDismissed` |
| 17 | Full setup flows (`/dashboard`, `/sessions`) still work (regression) | ✅ routes verified |
| 18 | Page refresh during quick time → active run restored with virtual swimmers grouped by lane (+ promoted real swimmers merged) | ✅ verified |
| 19 | Page refresh after completing a drill → `LaneDrillResult` data persists | ✅ verified |
| 20 | Completing a session and returning to `/` shows the picker again (never auto-starts) | ✅ verified |
| 21 | Post-session promote/skip modal for guests with recorded times (`BatchPromotionModal`) | ✅ verified |

## Related

- Live timing surfaces: `docs/context/UI-Context.md`
- Domain model: `docs/context/Drill-Model-Context.md`, `docs/context/Session-Model-Context.md`
- Data model: `docs/context/DB-Context.md`
- End-to-end journeys: `docs/context/Main-Flow.md`
