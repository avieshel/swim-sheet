# Session Initiatives — Implementation Plan

## Objective

Implement the two session-view initiatives from their design docs, refined by the
two-persona debate (P1 "Deck Timer" ↔ P2 "Set Architect"):

- **Initiative 1** — Template creation + **promote-to-live** (`Session-Creation-To-Live-Context.md`)
- **Initiative 2** — **Past-sessions table** + swimmer-filtered history (`Past-Sessions-Data-Context.md`)

Both conform to the **same data layer**: one additive read-model service +
`RunHistoryTable` component serve every entry point; `startFromTemplate` produces the
runs they read.

## The debate that shaped this plan

Two independent persona agents (P1: times everything, ≤2 taps, no planning;
P2: plans complex sets, timing is the exception) reviewed both designs, then
cross-examined each other. They settled a list. **This plan ratifies it:**

1. **Ship order: read-model history core first.** `RunSummary` is pure additive reads —
   no schema change — so the table ships and works **off existing quick-start runs today**.
2. **One Start Live modal, two paths.** Opens **pre-filled → "Quick start" is one tap**
   (P1). `Configure` (per-lane base pace, which drills timed, drill-1 preselect) is an
   expander P2 opens. No modal chain; overwrite-confirmation becomes an **undo toast**.
3. **One create wizard, two entries.** Step 1 is P1's **plain-swim fast lane**
   (name + distance + reps, add). Phase tags live behind a collapsed "Structure" section
   (P2's domain), defaulting safely: warmup/cooldown → untimed default, main set → timed.
4. **History is data-first, not metadata-first.** Columns order: times → attendees →
   dates/pool/distance. Row **expand** shows per-drill, per-swimmer times (from the blob)
   without navigation.
5. **"Untimed" is a record choice, never a mode.** Every drill the coach touches keeps a
   reachable clock; untimed just renders "—"/instruction card. Phase labels set a default,
   never a gate.
6. **Virtual `quick-*` swimmers filter by NAME — best-effort, display-only.**
   Shows a "likely match" badge, **never writes a phantom `RunSwimmer` row**, never
   automerges on name collision. Promotion (A-030) stays the durable identity path.
7. **Quick-time auto-start is preserved byte-for-byte.** After Complete, land on the
   time readout (not the "Starting timer…" dead-end).
8. **Mining ("save this section from a run")** is deferred and lives **only inside the
   run-detail expand** — never a history-table row action, never on the deck.
9. **The set grammar / timing model is a SEPARATE track** (existing
   `A-020/A-021/A-024/A-025/A-035`). It is forward-compatible plumbing here, not a gate.

## Sequencing strategy

```
Phase 0  Shared read model + RunHistoryTable        ← foundation, ships off quick runs
Phase 1  Past-sessions surfaces                     ← Initiative 2 (table + filters)
Phase 2  Promote-to-live (Start Live)               ← Initiative 1 (run production)
Phase 3  Template creation wizard                   ← Initiative 1 (authoring)
Phase 4  Grammar/timing enrichment + mining         ← SEPARATE track (existing A-tasks)
```

Rationale (from the debate): time-at-a-glance is the deck coach's motivation fuel and is
possible today; letting that land first — while keeping the snapshot forward-compatible —
is the "neither waits" settlement.

---

## Phase 0 — Shared read model + `RunHistoryTable`

Goal: one read model + one table component both initiatives render.

> **Phase 0 status: DONE** — S-001..S-004 + S-010 (folded in for the knip gate) shipped.
> `getLapsForRun` added to dao; `runHistoryService` read model (blob-first, lap fallback,
> real+virtual merge, name-match flag, swimmer filter); `getRunHistory` api wrapper;
> `RunHistoryTable` wired into SessionsList replacing the `CompletedRunsSection` stub.
> Verified: `npm run check` green (23 files / 294 tests). Remaining Phase 1 work:
> dedicated `/runs` page, SessionsList swimmer-selector, SwimmerDetail wiring.
> Note: `S-010` (SessionsList wiring) is folded into Phase 0 — the knip gate treats an
> unreferenced `RunHistoryTable` component as dead code, so it must have a live render
> site in the same phase. `/runs`, the swimmer filter, and SwimmerDetail wiring remain
> in Phase 1.

### Tasks

**S-001 — DAO: `getLapsForRun(runId)`** — `client/src/db/dao.ts` ✅
Mirror `getLapsForSwimmerInRun` (`dao.ts:268-273`): loads run's `RunDrill`s, then
`db.laps.where('run_drill_id').anyOf(ids)`. Pure CRUD, no business logic.

**S-002 — Service: `runHistoryService`** — `client/src/services/runHistoryService.ts` (new) ✅
- Types (see `Past-Sessions-Data-Context.md` D-1): `RunSummary`, `RunSwimmerSummary`.
- `resolveSwimmerTimes()` — **blob-first** (`LaneDrillResult.data` → `SavedDrillData
  .swimmers[].laps`), `Lap` fallback; single canonical implementation.
- `buildRunSummaries(runs, { swimmerId? })` — joins Session (templateName), RunDrill
  (drillCount/totalDistance), RunSwimmer+Swimmer (attendees), blobs/laps (times).
- `getRunHistory({ swimmerId?, sessionId? })` — orchestrator. Attendee = links ∪ blobs
  (names). Swimmer filter matches by `swimmer_id` link **or** blob `dbId` **or best-effort
  name** (virtual). Sort by date desc.
- Derived: `durationMs`, `timedDrillCount`, `bestLap`, `totalTime`, `times`.

**S-003 — API: `getRunHistory`** — `client/src/api/runs.ts` ✅
Thin delegating wrapper over the service (REST `GET /runs?filter=`).

**S-004 — Component: `RunHistoryTable`** — `client/src/components/RunHistoryTable.tsx` (new)
- Data-first columns: **recorded times** → attendees → date → template → pool → drills/
  distance. Responsive: stacked card list on mobile, sortable table on desktop.
- Inline **row-expand** detail: per-drill, per-swimmer times + stroke counts via
  `resolveSwimmerTimes` (no navigation).
- `swimmerId?` prop (fixed filter) + `onRowExpand` for the `/runs/:id` hook.
- Loading / empty states per surface (`Past-Sessions-Data-Context.md` D-2).
- Uses `formatTime`, design tokens, touch targets ≥48px (T-015).

**Definition of done (P0):** `npm run check` green; unit coverage on the projection
(blob-first, lap-fallback, merge, filter, virtual exclusion); table renders real quick-run
data without any other feature present.

---

## Phase 1 — Past-sessions surfaces (Initiative 2)

> **Phase 1 status: DONE** — S-011 `/runs` page (swimmer select + From/To date filter +
> `?swimmer=` deep link), S-012 SwimmerDetail now renders `RunHistoryTable` fixed to the
> swimmer, S-013 "likely match" badge rendered in the table + run detail (display-only,
> no writes), S-014 `/runs/:id` RunDetail page (per-swimmer × per-drill times matrix,
> cascade delete via `deleteSessionRunCascade`, JSON export) all shipped. Routes
> `/runs` + `/runs/:id` wired in `App.tsx`. Verified: `npm run check` green
> (23 files / 302 tests).
>
> **Follow-up refinements (S-011/S-014 polish):** `RunHistoryTable` gained an opt-in
> `showDelete` prop (per-row delete → `ConfirmDialog` → `deleteRun` cascade; removes the
> row in place). Sessions list + `/runs` page enable it; the swimmer view does not.
> Expanded rows now focus on a single swimmer when `swimmerId`/`focusName` are set
> (SwimmerDetail, and `/runs` when a swimmer filter is active) and render a
> "View full session →" link to `/runs/:id`. Verified: 304 tests green.
>
> **Follow-up polish v2:** Times column removed from the table (data-first → Session |
> Attendees | Actions). Session cell now shows name, date, **start time**
> (`startedAtMs` added to the read model; sorted by date then start time so the same
> session at 6am/7am/8am navigates in order), pool length, pool name. Attendees cell
> truncates as "Avi, Doron, Eran and 6 more" and is clickable → dialog listing all
> attendees with a "Stats" link to each swimmer's page (guests show "No profile").
> Swimmer view marks the newest run with a **"Last attended"** badge; chevron removed
> (row click implies expand). Swimmers list button relabeled "View Stats" → "Stats".
> Verified: 306 tests green.
>
> **Follow-up polish v3 (swimmers page):** Swimmer card now shows group + status as
> compact header labels; the former GROUP/STATUS stat boxes were replaced with
> **"LAST SESSION"** (link → `/runs/:id`, with template + date) and **"SESSIONS · 30D"**
> (completed runs in the last 30 days). Computed in-memory from one `getRunHistory()`
> fetch (`computeSwimmerStats` in `SwimmersList.tsx`; matches by id with name fallback).

**S-010 — SessionsList: replace `CompletedRunsSection`** — `client/src/pages/SessionsList.tsx`
Swap the stub (`:319-357`) for `RunHistoryTable` (no filter) behind a "Past Sessions"
header; "View all → /runs".

**S-011 — `/runs` page + swimmer filter** — `client/src/pages/RunsHistory.tsx` (new)
- `getRunHistory({ swimmerId })` driven; **swimmer filter dropdown** (roster; blank = all)
  + optional date range; reads `?swimmer=<id>` deep-link.
- Swimmer-link and "View all →" from SessionDetail/swimmer pages pass `?swimmer=`.

**S-012 — SwimmerDetail: replace bare run list** — `client/src/pages/SwimmerDetail.tsx`
Use `RunHistoryTable` fixed to the swimmer (`:176-202`); name-match badge (S-013) so
virtual swimmers who raced by name appear.

**S-013 — Name-match (display-only)**
`runHistoryService` per-swimmer view: when no `RunSwimmer`/blob-`dbId` link exists, match
blob `name` ↔ roster name (case-insensitive), flag `matchedByName: true`. Component
renders a **"likely match" badge**; no writes, no phantom rows, no auto-merge (A-030
stays sacred).

**S-014 — Run detail drill-down** — `/runs/:id` route + expand: per-drill table with
per-swimmer times/stroke counts; **delete run** (cascade per `dao.ts:186-191` pattern)
with ConfirmDialog; **export run data** (JSON blob, SwimmerDetail pattern); mining slot
reserved (enabled in Phase 4, see note).

**DoD (P1):** sessions + swimmer views show times at a glance; swimmer filter + deep link
work; virtual match is badged, no data written; delete/export on detail; `npm run check`.

---

## Phase 2 — Promote-to-live (Initiative 1, production side)

**S-020 — Promote service** — `client/src/services/runService.ts`, `api/runs.ts`
`startFromTemplate(sessionId, input)` (D-4): `createFromTemplate` + `RunSwimmer` insert
loop; guardrail: DAO auto-completes prior active run (`dao.ts:149-155`). API wrapper
`startRunFromTemplate`.

**S-021 — `LiveSessionSetupModal`** — `client/src/components/forms/LiveSessionSetupModal.tsx`
Date/pool/pool-length (pre-filled from template), swimmer→lane (pre-checked from **most
recent** `RunSwimmer` links per template). **Weak-path buttons:**
- Primary **"Quick start"** — uses last-run/live defaults, one tap.
- Secondary-expander **"Configure"** — per-lane base pace, timed-drill selection, drill-1
  pre-select (stored on run notes; consumed by deck when available).
- Overwrite-confirm → **undo toast** (never a second dialog).

**S-022 — Wire the action** — `SessionsList` card primary "Start Live"
(stopPropagation) + `SessionDetail` header button. Confirm → `startFromToLive` →
`navigate('/live')`.

> **Partial (A-049).** The "Start Live" primary action shipped on both `SessionsList`
> cards and the `SessionDetail` header via a shared `useStartLiveSession` hook (now used
> by `LiveDeck` too), navigating to `/live`. Templates with no drills are disabled. The
> `LiveSessionSetupModal` (S-021 — date/pool pre-fill, "Quick start"/"Configure"
> expander, overwrite undo toast) remains unimplemented; starting simply uses
> `createRunFromTemplate` defaults, and an existing active run is auto-completed by the DAO.

**S-023 — LiveDeck hand-off + post-Complete landing** — `client/src/pages/LiveDeck.tsx`
- Verify planned-run active-run init (`:1146-1172`) renders a promoted run unchanged;
  if `Configure` set drill-1/notes, pass it through.
- **Fix Complete landing:** after `onComplete`, land on a "Session saved — view times"
  readout (navigates to `/run/` detail) before the next auto-start;
  keep `autoStartedRef` reset behaviour identical otherwise.

**DoD:** one-tap Quick start from any template (incl. default) reaches `/live`; Configure
extends without gating; undo toast for overwrites; post-Complete → readout; quick-time
auto-start untouched.

---

## Phase 3 — Template creation wizard (Initiative 1, authoring side)

**S-030 — `SessionCreateModal`** — `client/src/components/forms/SessionCreateModal.tsx`
Step 1 plain-swim fast lane (name + distance + reps, "last-used defaults"),
Step 2 drill-bank picker, Step 3 review totals. "Structure" collapsed section for phase
tagging + focus/labels (P2 controls; defaults safe per settled #3). One commit:
`createSession` + ordered `createDrill` → navigate(`/sessions/:id`).

**S-032 — Wire SessionsList** — replace `showNewForm` inline block
(`SessionsList.tsx:36-215`) with the modal. Remove dead inline form.

**S-033 — Default template polish**
- Export shared `DEFAULT_QUICK_SESSION_NAME` constant; display-friendly label
  ("Quick Time — 100m Freestyle") + pool icon chip.
- Verify render in list with drill counts/totals; delete/rename → next quick-start
  recreates (resilience retained `runService.ts:208-230`). Keep visible, never hidden.

**DoD:** "New Template" lands on a populated editor; the default session remains a normal
editable visible template; `npm run check` + e2e for both paths.

---

## Phase 4 — Deferred/community track (NOT in this plan's scope)

Referenced for forward-compat; owned by existing tasks `A-012`(superseded)/`A-020`/
`A-021`/`A-024`/`A-025`/`A-035`.
- `RunDrill` additive `segmentLabel?`/`untimed?` carry-through in `createFromTemplate`
  (serializer-only; P1 accepted, P2 gated).
- Per-drill/per-rep fidelity in the expand (send-off ladders, recovery tags).
- Phase-default timing model (A-025) + untimed instruction cards.
- Sections entity (A-024) + **mining inside run-detail expand** (settled #8).
- No ordering dependency on Phase 0-3; when landed, table & detail render the extra
  fields for free.

---

## Cross-cutting

- **Layers respected:** never import `db/` from pages/components; DAO = pure CRUD
  (S-001), services own business logic (`S-002`, `S-040`, `S-003`), pages → api → services.
- **No schema change** across P0-P3; the data model additions are `getLapsForRun` (DAO)
  and `RunSummary` types (service).
- **Performance:** batch reads with `anyOf`; memoize table; revisit pagination only if
  roster scale demands.
- **Test checkpoints:** co-located `__tests__` per new service/DAO; API delegate tests;
  Playwright e2e in `tests/` (create wizard → editor with drills; Start Live → `/live`
  lanes; `/runs` swimmer filter; swimmer detail rows; delete run confirm).
- **`npm run check`** must pass at every phase boundary (lint + tsc + vitest).

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
3. e2e happy paths reproduce green on a fresh DB (default template visible; created →
   editor; promote → live; times at a glance; swimmer filter; delete run).
4. Context docs flagged in `AGENTS.md` index; this plan kept in sync when
   implementation deviates.