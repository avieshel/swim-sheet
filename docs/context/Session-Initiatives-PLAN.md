# Session Initiatives — Implementation Plan

Implementation plan for Initiative 1 (template → live) and Initiative 2 (past-sessions
table). Sister docs: `Session-Creation-To-Live-Context.md`, `Past-Sessions-Data-Context.md`.

## The debate that shaped this plan

Two persona agents (P1 "Deck Timer" ↔ P2 "Set Architect") reviewed both designs, then
cross-examined. Settled points (ratified):

1. **Ship order: read-model history core first.** `RunSummary` is pure additive reads —
   no schema change — so the table ships off existing quick-start runs today.
2. **One Start Live modal, two paths.** Opens pre-filled → "Quick start" is one tap
   (P1). `Configure` (per-lane base pace, timed drills, drill-1 preselect) is an
   expander P2 opens. No modal chain; overwrite-confirmation becomes an undo toast.
3. **One create wizard, two entries.** Step 1 is P1's plain-swim fast lane (name +
   distance + reps). Phase tags live behind a collapsed "Structure" section, defaulting
   safely: warmup/cooldown → untimed, main set → timed.
4. **History is data-first, not metadata-first.** Columns: times → attendees → dates/
   pool/distance. Row expand shows per-drill, per-swimmer times (from the blob) without
   navigation.
5. **"Untimed" is a record choice, never a mode.** Every drill the coach touches keeps a
   reachable clock; untimed just renders "—"/instruction card. Phase labels set a
   default, never a gate.
6. **Virtual `quick-*` swimmers filter by NAME — best-effort, display-only.** Shows a
   "likely match" badge, never writes a phantom `RunSwimmer` row, never automerges.
   Promotion (A-030) stays the durable identity path.
7. **Quick-time auto-start was removed entirely** (superseded). LiveDeck is picker-only;
   Complete returns to the picker (fresh start, never auto-starts).
8. **Mining ("save this section from a run")** is deferred and lives only inside the
   run-detail expand — never a history-table row action, never on the deck.
9. **The set grammar / timing model is a SEPARATE track** (existing A-020/A-021/
   A-024/A-025/A-035). Forward-compatible plumbing here, not a gate.

## Sequencing

```
Phase 0  Shared read model + RunHistoryTable        ← DONE (foundation, ships off quick runs)
Phase 1  Past-sessions surfaces                     ← DONE (table + filters)
Phase 2  Promote-to-live (Start Live)               ← PARTIAL (action shipped; setup modal not)
Phase 3  Template creation wizard                   ← NOT BUILT (open)
Phase 4  Grammar/timing enrichment + mining         ← SEPARATE TRACK (existing A-tasks)
```

## Phase 0 — Shared read model + `RunHistoryTable` (DONE)

Shipped: `getLapsForRun` (DAO), `runHistoryService` read model (blob-first, lap
fallback, real+virtual merge, name-match flag, swimmer filter), `getRunHistory` API
wrapper, `RunHistoryTable` (now `components/Table.tsx:281`, serves `/runs` and
`/swimmers/:id`). Verified `npm run check` green. SessionsList diverged to a
"Recently Completed" `SessionCard` grid with per-card delete/export, driven by
`getRunHistory`/`deleteRun`/`countCompletedRunsForSession` (`SessionsList.tsx:497-576`).

## Phase 1 — Past-sessions surfaces (DONE)

Shipped: `/runs` page (swimmer dropdown + From/To date filter + `?swimmer=` deep
link), SwimmerDetail renders `RunHistoryTable` fixed to the swimmer, "likely match"
badge (display-only, no writes), `/runs/:id` RunDetail page (per-swimmer × per-drill
times matrix, cascade delete, JSON export). Routes wired in `App.tsx`. Plus three
polish passes: per-row delete (`showDelete`), swimmer-focused expand, Times column
removal + start time/pool length, "Last attended" badge, attendees dialog.

## Phase 2 — Promote-to-live (PARTIAL)

The "Start Live" primary action shipped on SessionsList cards and the SessionDetail
header via a shared `useStartLiveSession` hook (now used by LiveDeck too), navigating
to `/live`. Templates with no drills are disabled. The hook calls `createFromTemplate`
directly, stamps notes, opens 2 default empty lanes via `buildStartLanes`
(`api/runSetup.ts:59`), and a pre-existing active run is **deleted** (cascade) by the
single-active-run rule in `runService.create` — not auto-completed.

**Not built**: `LiveSessionSetupModal` (date/pool pre-fill, "Quick start"/"Configure"
expander, overwrite undo toast). Starting uses `createRunFromTemplate` defaults (date =
today, `poolName: 'Live'`, 2 empty lanes). Post-Complete lands on the Live picker
(no auto-start).

## Phase 3 — Template creation wizard (NOT BUILT)

`SessionCreateModal` (step 1 plain-swim fast lane: name + distance + reps; step 2
drill-bank picker; step 3 review totals; collapsed "Structure" section for phase
tagging) and wiring in `SessionsList` (replace the inline `showNewForm` block) were
never built. `DEFAULT_QUICK_SESSION_NAME` is exported from
`hooks/useStartLiveSession.ts:10` but still duplicated in `runService.ts:287`.

**Sticky seed dismissal (shipped, supersedes the original "recreates on delete")**:
deleting a `catalogKey`-ed starter session marks the seed dismissed
(`sessionService.delete` → `markSeedSessionDismissed`, `sessionService.ts:60-62`), so
it stays deleted instead of being recreated.

## Phase 4 — Deferred/community track (NOT in scope)

Owned by existing tasks A-020/A-021/A-024/A-025/A-035. Prerequisite gone: the phase
referenced a persisted drill **tag/phase** mechanism (A-016's warmup/cooldown/main-set
tags) that no longer exists — phases are now the `PHASE_LABELS` constants
(`constants/drill.ts:29`: warmup, pre-set, main set, cool down, taper), display-only,
no persisted tag, no auto-start. A-025's "phase-default timing model" needs a new
persisted mechanism first.

Remaining items: `RunDrill` additive `segmentLabel?`/`untimed?` carry-through;
per-drill/per-rep fidelity in the expand (send-off ladders, recovery tags);
phase-default timing model + untimed instruction cards; sections entity (A-024) +
mining inside run-detail expand; no ordering dependency on Phase 0-3.

## Cross-cutting

- **Layers respected**: never import `db/` from pages/components; DAO = pure CRUD;
  services own business logic; pages → api → services.
- **No schema change** across P0-P3; additions are `getLapsForRun` (DAO) and
  `RunSummary` types (service).
- **Performance**: batch reads with `anyOf`; memoize table; revisit pagination only
  if roster scale demands.
- **Test checkpoints**: co-located `__tests__` per new service/DAO; Playwright e2e in
  `tests/` (create wizard → editor with drills; Start Live → `/live` lanes; `/runs`
  swimmer filter; swimmer detail rows; delete run confirm).
- **`npm run check`** must pass at every phase boundary.

## Risks

| Risk | Mitigation |
|---|---|
| Name-match creates duplicate/orphan perception | Badge it "likely/matched"; never writes; documented in A-030 |
| Blobless runs on other devices (sync) | Lap fallback in `resolveSwimmerTimes` |
| One active-run auto-complete surprises coach mid-session | Undo toast in setup modal (settled #2) |
| History data volume | anyOf batching now; pagination follow-up |

## Definition of Done (whole plan)

1. `npm run check` passes.
2. Both context docs' "Implementation tasks" and this plan's phases are all closed or
   explicitly deferred with a cross-reference.
3. e2e happy paths reproduce green on a fresh DB.
4. Context docs flagged in `AGENTS.md` index; this plan kept in sync when
   implementation deviates.