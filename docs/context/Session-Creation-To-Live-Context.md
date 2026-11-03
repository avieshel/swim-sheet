# Session Creation → Live Promotion — Context (Initiative 1)

> **Status: partially as-built.** The **promotion** ("Start Live") path is SHIPPED via the
> shared `useStartLiveSession` hook. The **authoring** flows (`SessionCreateModal`,
> `LiveSessionSetupModal`) were never built and remain open as ideas, not committed plan.

## Purpose

How a coach creates a reusable session template and then **takes it live**. Sister document:
`Past-Sessions-Data-Context.md` (Initiative 2), which reads the `SessionRun`/`RunDrill`/
`RunSwimmer`/`LaneDrillResult`/`Lap` records this flow produces.

Scope as built: `pages/SessionsList.tsx`, `pages/SessionDetail.tsx`, `pages/LiveDeck.tsx`,
`hooks/useStartLiveSession.ts`, `services/runService.ts`, `api/runSetup.ts`,
`components/live/*` (the live run view).

---

## Shipped: "Start Live" promotion

### Where

| Surface | Behavior |
|---------|----------|
| `SessionsList` template cards | Primary **Start Live** button (reads **View Live** when that template owns the active run); `Open Template` is the secondary affordance |
| `SessionDetail` header | **Start Live** (~`SessionDetail.tsx:271-272`), same hook |
| `LiveDeck` picker (`/`, `/live`) | Pinned quick-time card + template cards ranked by usage; selecting one calls `startLiveSession` (`LiveDeck.tsx:25-33`) |

All three share `hooks/useStartLiveSession.ts` — one canonical flow.

### What starting does (verified)

`useStartLiveSession.ts:22-51`:

1. `createRunFromTemplate(sessionId, { date: today, poolName: 'Live' })` →
   `runService.createFromTemplate` (`runService.ts:226`): snapshots `Drill → RunDrill`
   (item/repeat flattening + set/rep labels), freezes `sessionName` + `sessionSnapshot`
   on the run, stamps `status:'active'` + `sessionStartedAt`.
2. `buildStartLanes(null, { prefillTempSwimmers })` (`api/runSetup.ts:59`) opens
   **2 default empty lanes**; temp-swimmer prefill happens **only** when the template is
   the default quick session AND the real roster is empty (`runSetup.ts:32` — 2 temps in
   Lane 1, 1 in Lane 2 as a hint, per `useStartLiveSession.ts:38-46`).
3. `notes = { isQuickStart: false, version: 2, virtualSwimmers }`, `INIT_FROM_RUN`,
   hand-off to the active run view. There is no setup form on this path — swimmers are
   assigned on the deck via the lane editor.

### Design decisions that shipped

- **Hand-off via active-run detection** — the live view restores the run from `RunSwimmer`
  links + notes; no separate live-side state machine was added.
- **One active run.** `runService.create` (`runService.ts:78-85`) **deletes** the prior
  active run (cascade) rather than auto-completing it. Historical docs claiming
  "starting auto-completes the prior run" are wrong.
- **Delete-safe templates.** Deleting a template never mutates completed runs; runs carry
  their own frozen name/snapshot.
- **Default quick session.** `'Quick 100m freestyle (default)'` is a normal, visible,
  editable template. `DEFAULT_QUICK_SESSION_NAME` is exported from
  `hooks/useStartLiveSession.ts:10` — but `runService.ts:287` (`createQuickStartRun`)
  still carries its own duplicate literal (cleanup open).
- **Sticky seed dismissal.** Deleting a `catalogKey`-ed starter template is final:
  `sessionService.delete` calls `markSeedSessionDismissed` (`sessionService.ts:60-62`) so
  seeding does not recreate it. The starter catalog has its own picker route
  (`/sessions/catalog`, `CatalogScreen.tsx`); `Session.catalogKey` exists in the schema.

---

## Still open: template authoring

| Area | Reality |
|------|---------|
| Create template | `SessionsList.handleCreate` sends **name + notes only** (`SessionsList.tsx:105-115`); the coach creates a shell, then adds drills in the editor. **No `SessionCreateModal` exists.** Note: `Session` has **no pool-length field** — pool length comes from settings at run time (`runService.ts:230-232`) |
| Drill assembly | Done entirely in `SessionDetail` (drill rows, description via `DrillItem.description`, `DrillEditorModal` for full editing); drill-bank lives on `/drills` |
| Pre-start configuration | No date/pool/swimmer-lane setup modal — starting uses `createRunFromTemplate` defaults and 2 empty lanes. The imagined "overwrite warning" is moot while `runService.create` silently replaces the prior run |
| `startFromTemplate` composite | **Never built** — the hook above is the de-facto equivalent; optional swimmer-lane assignment at start time does not exist |

---

## Product requirement (original decision, still satisfied)

The default 100m freestyle session is a first-class, visible template — never hidden by an
`isQuickStart` filter, editable and renamable like any template. Quick *selection* from the
Live picker populates temp swimmers only while the roster is empty; starting that template
from elsewhere is a normal planned run.

## Data model

All tables already exist — no schema change: `Session`, `Drill` (+`DrillItem.description`),
`SessionRun` (frozen `sessionName`/`sessionSnapshot`), `RunDrill`, `RunSwimmer`, `Swimmer`.

## Open items

- `SessionCreateModal` (guided creation) and `LiveSessionSetupModal` (pre-start config) —
  unimplemented; only pursue if the coach-visible gap justifies it.
- Unify `DEFAULT_QUICK_SESSION_NAME` (hook export vs `runService.ts:287` duplicate).
- Optional: pre-select drill 1 / pass-through notes for promoted runs on the deck.
