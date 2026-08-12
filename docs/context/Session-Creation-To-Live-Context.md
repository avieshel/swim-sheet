# Session Creation → Live Promotion — Context (Initiative 1)

## Purpose

Focused design context for the **template-authoring and "take it live"** experience:
how a coach creates a reusable session template and then **promotes it into a running
live session**. It is one of two session-view initiatives that share a data layer; the
sister document is `Past-Sessions-Data-Context.md` (Initiative 2), which reads the
`SessionRun`/`RunDrill`/`RunSwimmer`/`LaneDrillResult`/`Lap` records that this
initiative produces.

Scope: `SessionsList.tsx`, `SessionDetail.tsx`, a new `SessionCreateModal` /
`LiveSessionSetupModal`, `LiveDeck.tsx` (active-run init path), `service/runService.ts`
(promotion), `service/sessionService.ts`, and the shared read-model service used by
Initiative 2 (`service/runHistoryService.ts`).

---

## Background

### The two sub-flows this initiative covers

1. **Creating a new session template** — the authoring flow (name, pool, notes, ordered
   drills from the bank, phase tags, totals).
2. **Promoting it to a live session** — the flow that snapshots the template into a
   `SessionRun`, links swimmers to lanes, and jumps into `LiveDeck`.

### Current state (gaps)

| Area | Current reality | Where |
|------|-----------------|-------|
| Template creation | Bare inline form: **name + pool length only** (no drills, no guidance). Coach must create a shell, then go into the editor. | `SessionsList.tsx:176-215` (`showNewForm` block) |
| Drill assembly | Done entirely in `SessionDetail` — up/down arrows, drill bank sidebar, `DrillEditorModal`. | `SessionDetail.tsx:484-730` |
| **Promote to live** | **Does not exist anywhere in the UI.** `createRunFromTemplate` is dead to the UI — it is only called by `createQuickStartRun`. Docs claim a "Run" action on template cards, but no such button/code exists. | `api/runs.ts:58`, `services/runService.ts:126-201,203-243` |
| Run hand-off | `LiveDeck` shows the **Live picker** (never auto-starts): a pinned quick-time card plus template sessions ranked by usage. Selecting a template starts a planned run via `createRunFromTemplate`. | `LiveDeck.tsx` |
| Active-run init | The planned-run init path already rebuilds groups from `RunSwimmer` links — so handed-off planned runs render correctly today, with one caveat (no drill pre-selected). | `LiveDeck.tsx:1146-1172` |
| Default quick session | URL session `'Quick 100m freestyle (default)'` is created on demand as a **normal, visible** template. | `runService.ts:203-230` |

> The stale `Sessions-Screen-Context.md` describes a rich "Create Session" hero, search,
> drag-and-drop, and a "Run" action that exist in docs but not in code. This document is
> the authoritative design for the two above-the-fold flows; that file should be treated
> as superseded.

---

## Product Requirement (user decision)

> "I want a **'default 100m freestyle'** session that is the **default session for Quick
> Time**, and **I want it to show on the UI.**"

Decisions derived from this:

- **The quick-time default session is a first-class, visible template** in `SessionsList` —
  identical in treatment to any other template card. It is **never hidden** by a
  "system"/`isQuickStart` filter.
- **It is editable and renamable like any template.** If a coach renames or deletes it,
  the next Quick Time selection recreates a fresh default template (`runService.ts:203-230`
  already finds-on-demand by name). This is acceptable and simple; the lookup resilience
  (G-5 below) is a hardening option, not a blocker.
- **Starting that template from the live/promotion flow is a normal planned run** — it is
  not special-cased. The **quick time *selection*** path (from the Live picker) is what
  populates its virtual swimmers (only while the roster is empty).
- The default template carries the friendly label **"Quick Time — 100m Freestyle"** and a
  recognizable pool icon in the header so coaches understand it is the bootstrap session.

---

## Design Decisions

### D-1. Template creation becomes a guided 3-step flow

Replace the inline `showNewForm` block with a reusable **`SessionCreateModal`**:

1. **Basics** — name (required), default pool length, notes/focus.
2. **Drills** — searchable drill-bank picker with phase tagging (warmup / main-set /
   cooldown) and per-add distance override; an "Add custom drill…" back door opens
   `DrillEditorModal`.
3. **Review** — totals card (drill count, total distance, stroke breakdown, focus chips)
   with a summary drill list; **Create Template**.

On **Create**: `createSession` + ordered `createDrill` writes (reusing
`SessionDetail.handleAddFromLibrary`/`handleSaveMeta` logic), then navigate to
`/sessions/:id` with the drills pre-loaded. This makes "New Template" a single committed
action instead of a two-screen dance.

Rationale: keeps the one-composed commit invariant — a session is only created whole —
reuses the proven editor as the follow-up surface (drill reorder/edit), and gives P2-style
coaches a fast path without forcing the editor on them.

### D-2. "Start Live" is the promotion surface

Add a **primary "Start Live" action** (`play` or `timer` icon, filled) in two places:

- Each template card in `SessionsList` (a primary button alongside/above the open-card
  affordance).
- The `SessionDetail` header (top-right, beside the edit pencil).

Both open the **`LiveSessionSetupModal`**:

```
┌──────────────────────────────────────────────┐
│ Start Live — Tuesday Endurance                │
│                                               │
│ [Calendar] Date          2026-08-06  (today)  │
│ Pool name                [________]           │
│ Pool length              [25 ▼] m             │
│                                               │
│ Swimmers → lanes                              │
│   [Search roster swimmers...]                  │
│   ☑ Jane Smith        Lane [1▼]               │
│   ☐ Bob Johnson       Lane [2▼]               │
│   [+] Add from roster        (skip: add live) │
│                                               │
│     [Start Live]   [Cancel]                   │
└──────────────────────────────────────────────┘
```

- Swimmer assignment is **optional**: checks/swimmer lanes are pre-filled from the *most
  recent* `RunSwimmer` links per template when available (same "guess most likely" signal
  in `Quick-Start-Context.md`); the coach can skip and add swimmers on the deck instead.
- On confirm: `runService.startFromTemplate(...)` (D-4) runs, then **navigate to `/live`**.

### D-3. Hand-off to LiveDeck via active-run detection (no forks)

`LiveDeck` already restores a planned active run from `RunSwimmer` links
(`LiveDeck.tsx:1146-1172`). Promoting a template therefore needs **no new live-side state
machine** — we rely on the existing "active run found → render" branch:

- `startFromTemplate` marks the run `active`. Only **one** active run is allowed — the DAO
  auto-completes a prior active run on insert (`dao.ts:149-155`), which is the desired
  "start fresh" semantic.
- After promotion we `navigate('/live')`; on mount `LiveDeck` finds the active run and
  builds lane groups from links. Coaches add/assign swimmers per lane as usual.
- The header title for the run resolves via `getSession(run.session_id).name` (already the
  case in `ActiveRunView`), so a promoted template shows its own name. Quick-run titles
  show the visible default template name.

Caveat surfaced: `currentRunDrillId` is `null` for linked runs (the planned-run init path).
`D-3` accepts drill-per-lane selection as today. If a future iteration wants "pre-select
drill 1", that is a small enhancement, not a prerequisite.

### D-4. Promotion service — the shared data-layer entry

`runService.startFromTemplate` composes existing primitives so both the modal and any
future call-site use one canonical entry:

```ts
interface StartFromTemplateInput {
  date: string               // default today
  poolName: string
  poolLength: number         // default from template
  swimmers?: { swimmerId: string; lane: number }[]   // optional lane assignments
}

startFromTemplate: async (sessionId, input): Promise<string> => {
  const runId = await createFromTemplate(sessionId, input) // existing snapshot logic
  for (const s of input.swimmers ?? []) {
    await addSwimmerToRun(runId, s.swimmerId, s.lane)
  }
  return runId
}
```

`createFromTemplate` (`runService.ts:126-201`) already snapshots `Drill → RunDrill`
(individal rep flattening + continuous sets) and stamps `status:'active'`. The optional
swimmer link loop is pure `RunSwimmer` insert (with the move-instead-of-duplicate rule in
`dao.ts:225-236`). **No schema change.**

### D-5. Guardrails

- **One active run.** Starting a template auto-completes any prior active run
  (`dao.ts:149-155`). The modal warns "starting this replaces the current live session"
  when an active run exists.
- **Delete-safe templates.** Deleting a template never mutates completed runs (already
  true — `RunDrill`s are snapshots). Templates with an active run should be shown as
  read-only or confirm first (guardrail note for the delete path).
- **Default template resilience.** Because the default quick-time template is visible and
  editable, quick-start must not crash if it's renamed/deleted — its lookup already
  re-creates on missing (`runService.ts:208-230`). Keep that behavior.
- **Virtual-swimmer compatibility.** A promotional run created with zero real swimmers can
  still add temp swimmers on the deck (`quick-*` ids); those are handled by the existing
  quick-start semantics and excluded from per-swimmer identity tracking until promoted
  (`A-030`).

---

## Data model

All tables already exist — **no schema change**.

| Table | Role in this initiative |
|-------|--------------------------|
| `Session` | The template being authored. |
| `Drill` | Ordered drills composed in the editor / create modal. |
| `SessionRun` | The hand-off run; `status:'active'`, stamped `startFromTemplate`. |
| `RunDrill` | Drill snapshot for the run (from `createFromTemplate`). |
| `RunSwimmer` | Optional lane assignment (swimmer → run). |
| `Swimmer` | Roster entries selected in `LiveSessionSetupModal`. |

The **shared read-model feed** for Initiative 2 (`RunSummary`) is keyed off
`SessionRun.id`/`RunDrill`/`RunSwimmer`/`LaneDrillResult`/`Lap` — see
`Past-Sessions-Data-Context.md` ("Shared Data Layer"). Promotion here is what makes the
run appear consistently in both the sessions history table and a swimmer's filtered view.

---

## API / service surface (delta)

Target 4-layer flow: `pages → api → services → dao`.

| Layer | File | Function | Notes |
|-------|------|----------|-------|
| service | `services/runService.ts` | `startFromTemplate(sessionId, input)` | D-4; wraps existing snapshot + RunSwimmer link |
| api | `api/runs.ts` | `startRunFromTemplate(sessionId, input)` | delegating wrapper |
| api | `api/drills.ts` | reuse `getSessionDrills`, `createDrill` | for wizard / editor |
| service | `services/sessionService.ts` | unchanged (`create/list/update/delete`) | |
| dao | none | — | no new CRUD |

No new DAO calls required for creation; the wizard composes existing session/drill
functions, mirroring `SessionDetail`.

---

## Implementation tasks

1. **`SessionCreateModal`** (`components/forms/SessionCreateModal.tsx`): 3-step form,
   drill picker with phase chips, totals review, create → `createSession` + `createDrill`
   bulk, then `navigate('/sessions/:id')`.
2. **Wire `SessionsList` "New Template"** to open the modal (replace `showNewForm` block,
   `SessionsList.tsx:36-215`). Remove dead inline form.
3. **`LiveSessionSetupModal`** (`components/forms/LiveSessionSetupModal.tsx`): date/pool/
   swimmer-lane form; "guess recent links" pre-check; start/skip.
4. **`runService.startFromTemplate`** + **`api/runs.ts startRunFromTemplate`**.
5. **`SessionsList` card** — add "Start Live" primary button (stop-propagation, opens the
   setup modal); "Open Template" becomes the secondary affordance.
6. **`SessionDetail` header** — "Start Live" button next to edit.
7. **Navigate to `/live`** on confirm; confirm the read-and-restored active-run path in
   `LiveDeck` without changes; add a `LiveSessionSetupModal` warning when a prior active
   run will be overwritten.
8. **Default template copy**: rename constant `'Quick 100m freestyle (default)` → a
   single shared `DEFAULT_QUICK_SESSION_NAME` exported from `constants/`; keep it looking
   like any template; verify it renders in `SessionsList` with drills counts/totals.
9. **Test suite** (see "Tests").

### Definition of done (Initiative 1)

- "New Template" opens the 3-step modal; creating a template lands on the populated
  editor.
- Every template card (including the default quick-time session) shows a working
  **Start Live** that snapshots the run and hands off to `/live`.
- `startFromTemplate` records `RunSwimmer` links for assigned swimmers; run is
  `status:'active'`; a pre-existing active run is auto-completed.
- The default `'Quick Time — 100m Freestyle'` session appears in the sessions grid and is
  editable/deletable; recreates on next quick-start if deleted.
- `npm run check` passes; co-located service tests cover `startFromTemplate` (snapshot +
  swimmer-link) and the create-wizard data path.

---

## Tests

Align with `Test-Context.md`.

- **Service** (`services/__tests__/runService.test.ts`): `startFromTemplate` calls
  `createFromTemplate` with forwarded fields and insert-one `RunSwimmer` per input with the
  correct lane; empty `swimmers` inserts none; throws if template missing.
- **DAO-pure** nothing new (reuses existing).
- **API** (`api/__tests__/runs.test.ts`): `startRunFromTemplate` delegates + returns
  `runId`.
- **UI/E2E** (`tests/`): create-template wizard reaches the editor with drills; "Start Live"
  on a template card → lands on `/live` and shows the assigned swimmer lanes; opening the
  default template card is possible; deleting then re-running quick-start recreates it.
- **Visual** (theme/mobile): the setup modal + create wizard use existing tokens/patterns;
  touch targets ≥ 48px (T-015).

---

## Open questions / follow-ups

- Pre-select drill 1 for promoted-planned runs on the deck (out of scope, see D-3).
- Whether "duplicate template" belongs in the creation modal (nice-to-have, aligns
  `F-6/A-023`).
- Confirm that renaming the default template should NOT be coupled to quick-start
  (recommendation:   quick-start always uses the canonical name constant and re-creates if
  absent — see D-5).