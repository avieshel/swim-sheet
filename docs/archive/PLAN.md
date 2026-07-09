# SwimSheet Implementation Plan

## Model: Session (Template) → SessionRun (Instance)

Sessions are reusable templates (blueprints with drills). The coach creates them on the Sessions page. On the Live page, they pick a template, configure date/pool/swimmers, and start a SessionRun — which snapshots the template's drills into RunDrill records. Lap data is recorded against RunDrills, preserving the historical record independently of template changes.

### Data Model

```
Session (template):    id, name, poolLength, notes, createdAt, updatedAt
  └── Drill:           id, session_id, name, stroke, distance, order, createdAt, updatedAt

SessionRun (instance):  id, session_id, date, poolName, poolLength, notes, status (active|completed), createdAt, updatedAt
  └── RunDrill:        id, run_id, name, stroke, distance, order, notes, createdAt, updatedAt  (snapshot)
  └── RunSwimmer:      id, run_id, swimmer_id, lane, createdAt, updatedAt

Lap:                   id, run_drill_id, swimmer_id, time, stroke_count, effort, notes, createdAt, updatedAt
```

### State Machine

```
Template ──[Start in Live View]──→ SessionRun (active) ──[Complete]──→ SessionRun (completed)
                                        ↑ edit drills per-instance       ↑ read-only historical record
```

---

## Phase 1: Context & Planning (DONE)

- [x] **Task 1** — Update CONTEXT.md with new domain glossary
- [x] **Task 2** — Update UI-Context.md with new UI descriptions
- [x] **Task 3** — Update SWIMMERS.md with new integration model
- [x] **Task 4** — Update USER-FLOWS.md with updated flows
- [x] **Task 5** — Update PLAN.md with new task breakdown

## Phase 2: Schema & DAO

- [ ] **Task 6** — Update client Dexie schema: add SessionRun, RunDrill, RunSwimmer; modify Session (add name, remove date/location); modify Drill (add order); modify Lap (drill_id → run_drill_id); remove SessionSwimmer
- [ ] **Task 7** — Update client DAO: new CRUD for SessionRun, RunDrill, RunSwimmer; update session/drill/lap functions

## Phase 3: Sessions Page (Template Manager)

- [ ] **Task 8** — Rewrite SessionsList: show template cards with name, drill count, total distance; "New Template" form; totals view
- [ ] **Task 9** — Rewrite SessionDetail: template editor with editable name/poolLength, drill list with add/delete/reorder, live totals (total distance, stroke breakdown, drill count)

## Phase 4: Live View (Session Runner)

- [ ] **Task 10** — Update LiveDeck: session setup UI (template picker, date/pool config, swimmer-to-lane assignment); start session button
- [ ] **Task 11** — Update LiveSessionContext: bridge to SessionRun model; load RunDrills from DB; save laps to Lap table
- [ ] **Task 12** — Add complete-session flow: save all data, set status='completed'

## Phase 5: Remaining Pages

- [ ] **Task 13** — Update DrillDetail: work with RunDrill + run context; display using new Lap linking
- [ ] **Task 14** — Update CoachDashboard: use template count, completed run stats; fix drill distance calculation
- [ ] **Task 15** — Update SwimmerDetail: show session runs from RunSwimmer instead of old SessionSwimmer

## Phase 6: Server & Sync (minimal)

- [ ] **Task 16** — Update server SQLite schema: add session_runs, run_drills, run_swimmers tables; update laps table
- [ ] **Task 17** — Update server routes for new entities

## Phase 7: Cleanup & Verify

- [ ] **Task 18** — Run build (`npm run build` in client), fix type errors, verify routing
- [ ] **Task 19** — Run Playwright tests, update test to reflect new model
- [ ] **Task 20** — Final review of all pages for broken imports/logic
