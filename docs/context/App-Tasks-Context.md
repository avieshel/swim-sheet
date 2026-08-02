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
**Status**: In Progress — `setLaneDrillResult` and `deleteSwimmerFromLaneDrillResult` moved to `runService.ts`. The dead DAO `createRunFromTemplate` was removed (the live implementation lives in `runService.ts`). Remaining items (seed data functions) deferred due to large hardcoded seed data (~400 lines).

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

## A-012: Runs history — Past session management

**Source**: `USER-FLOWS.md` (flow 5)

Browse completed SessionRuns on a dedicated `/runs` page with full session management:

- **List view**: Show all completed/saved runs with date, session name, pool, drill count, total swimmers
- **Detail view**: Per-run review with per-group, per-drill, per-swimmer lap data — loaded from `LaneDrillResult` JSON and `Lap` table
- **Actions**: Delete old runs, re-open a completed run for review (read-only), export run data
- **Live view split**: Live view (`/`) only has Reset and Complete — no delete, no browsing. All historical management lives on the Runs screen.
- **Navigation**: Accessible from sidebar nav (desktop) and bottom nav (mobile)

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

---

## A-020: Session-building flow — Support progressive intervals & recovery interleaves

**Source**: `docs/context/Sessions-Drills-Context.md` (reference endurance session)

**Problem**: A real endurance session ("4×200m send-off 4:00→3:45 with 50m easy @ 1:00 between each") cannot be built as written. `DrillItem.interval` is a single string; `createFromTemplate` gives every rep the same interval. Recovery swims between reps must be separate drills.

**Solution**:
1. `interval` accepts a progression (`4:00, 3:55, 3:50, 3:45` or `4:00 → 3:45`) — resolve per-rep at snapshot time in `createFromTemplate`.
2. Optional `recovery` sub-component on a drill item ("between each rep: 50m easy @ 1:00") — flatten as alternating reps (200, 50, 200, 50, …), tag recovery reps easy.
3. Per-rep send-off / recovery labels surface in the live deck.

**Files**: `client/src/db/schema.ts`, `client/src/components/DrillEditorModal.tsx`, `client/src/services/runService.ts`

**Priority**: High
**Status**: Open

---

## A-021: Set segments — named components linkable to the drill bank

**Source**: `docs/context/Sessions-Drills-Context.md`

**Problem**: Drill items collapse "50m fingertip drag / 50m fist / 50m breathing every 5" into anonymous "4x50 freestyle". `DrillSegment` has a `name` but isn't editable in the modal.

**Solution**: Add optional `name` (and `note`) to `DrillItem`, with a picker linking segments to existing bank drills (Fingertip Drag, Fist Drill already seeded). Render segment names on session cards and in the live deck.

**Files**: `client/src/db/schema.ts`, `client/src/components/DrillEditorModal.tsx`, `client/src/pages/SessionDetail.tsx`, `client/src/services/runService.ts`

**Priority**: Medium
**Status**: Open

---

## A-022: Kickboard equipment option missing from picker (data inconsistency)

**Source**: `docs/context/Sessions-Drills-Context.md`

**Problem**: `EQUIPMENT_OPTIONS` (`client/src/constants/drill.ts:28`) omits `kickboard` even though `DEFAULT_EQUIPMENT` and seed data use it (`client/src/db/dao.ts:287,789,819`). Coaches can't select a kickboard in the modal.

**Note**: This is *not* about the warm-up's "kick" segment — that is a kicking-focus freestyle with **no accessory** (expressed via segment name/note, see A-021). No "kick" stroke type should be added.

**Solution**: Add `kickboard` to `EQUIPMENT_OPTIONS`; recheck the 4-col equipment grid layout with 5 items.

**Files**: `client/src/constants/drill.ts`

**Priority**: Medium
**Status**: Open

---

## A-023: Session detail — duplicate drill action & similar-warning refinement

**Source**: `docs/context/Sessions-Drills-Context.md`

**Problem**: Building progression sets requires ~9 modal round-trips; no copy/duplicate on the drill row. The similar-drill warning fires for intentionally-distinct sets (same name + equipment, different interval).

**Solution**: Add a duplicate button on session drill rows (duplicates into the session, opens editor pre-filled). Suppress the similar-drill warning when drills differ only by interval.

**Files**: `client/src/pages/SessionDetail.tsx`, `client/src/utils/drillHelpers.ts`

**Priority**: Medium
**Status**: Open

---

## A-024: Reusable session sections (blocks) — the "save the warm-up" feature

**Source**: `docs/context/Sessions-Drills-Context.md` (F-8, Coach's Mental Model)

**Problem**: The unit a coach reuses — a phased section like "standard warm-up" — doesn't exist. Sessions are flat drill lists; the only reuse units are atomic drills (too granular to save a warm-up) and whole sessions (too coarse to remix). Coaches repeat their settings every session.

**Solution**: Introduce a **section/block** entity — a named, phased (warmup/main-set/cooldown), ordered group of drills:
1. Composes into sessions (a session = ordered list of sections).
2. Saved to a section library (save once, pull into any session).
3. Mineable: "save section from this session/run" creates a library section from an existing template's drills or a completed run's run drills.
4. Sections carry their phase, so pulled drills don't need re-tagging.
5. **Copy-on-pull** (product-owner decision, three-persona review): pulling a library section copies it into the session — the library stays canonical; tweaks to a pulled section never mutate the library.
6. **Section phase wins** (product-owner decision): when a section carries a phase, it overrides individual drill tags for A-025 timing defaults.

**Files**: `client/src/db/schema.ts` (new table), `client/src/db/dao.ts`, `client/src/services/` (new sectionService), `client/src/pages/SessionDetail.tsx`, `client/src/pages/SessionsList.tsx`

**Priority**: High
**Status**: Open

---

## A-025: Runtime timing — phase-based defaults + per-lane/per-swimmer opt-in

**Source**: `docs/context/Sessions-Drills-Context.md` (F-9)

**Problem**: Warm-ups/cool-downs aren't timed, and the main set *might* be timed (not every rep, not every swimmer). Today `timingMode` is a saved binary on the drill, every live drill shows Start/Lap/Finish, and the phase `labels` (which could carry a default) only drive the Progress-Mode banner.

**Solution**: Separate the three questions:
1. Phase (warmup/main-set/cooldown) supplies the *default* timing intent — warm-up/cool-down → untimed, main-set → timed — as a soft preference, not a binary.
2. At run time the coach can mark a drill timed/untimed per lane, or start/stop timing individual swimmers.
3. A swimmer's per-lap record is created only when actually timed (feeds future progress tracking).
4. Untimed drills render as instruction cards (no clock); timed drills render with the clock.

**Files**: `client/src/context/LiveSessionContext.tsx`, `client/src/pages/LiveDeck.tsx`, `client/src/components/SwimmerRows.tsx`, `client/src/services/runService.ts`

**Priority**: High
**Status**: Open

---

## A-026: Two-mode UX — "Quick Time" and "Planned Session" over one drill substrate

**Source**: `docs/context/Sessions-Drills-Context.md` (Debate Outcome)

**Problem**: The app serves two coaches with opposite needs — P1 (Deck Timer): ≤2 taps to an always-timed stopwatch, no session concepts; P2 (Set Architect): rich, reusable, phase-aware session plans where timing is opt-in. Today both are jammed into one flow (deck-first + heavy template editor).

**Solution**: One drill substrate where "100 Free" is the degenerate case of the full drill grammar; two start doors sharing the same timing engine, lane components, and lap data:
1. **Quick Time** (deck-first, default): plain-swim picker = filtered view of the drill bank; everything timed; "untimed" structurally impossible in this mode; one-touch swimmer chips; tap-to-reset, no modals. **The quick run accumulates drills** — "add drill" appends another plain pick to the active run (same swimmers, identity chain intact), each a labeled row in the deck, add/remove anytime. **First pick creates row #1; every later pick appends a new row — never replaces** (product-owner decision, three-persona review). **Quick rows are rep-agnostic**: lap-anytime, no `repeatCount` auto-advance, no rep-count control on the deck — quick mode is a UI mode over the one drill model, not an API flag.
2. **Planned Session** (editor-first): section-based builder, rich set grammar, phase-default timing, section library (save/mine).
3. Timing defaults key off how the run started (quick = timed everything; planned = phase-based). When a planned run is active the deck renders its structure (segments, send-off ladder, recovery tags).

**Files**: `client/src/pages/LiveDeck.tsx`, `client/src/context/LiveSessionContext.tsx`, `client/src/pages/SessionDetail.tsx`, `client/src/db/schema.ts`, `client/src/services/runService.ts`

**Priority**: High
**Status**: Open

---

## A-027: Plain-swim picker on the deck (P1)

**Source**: `docs/context/Sessions-Drills-Context.md` (Debate Outcome, P1 friction #1)

**Problem**: Quick-start locks the coach to "100m Freestyle"; there's no way to pick "200m Breast" from the deck without abandoning timing and editing the template. There's also no way to add a second drill to an active quick run (the coach wants "8×100 free, then a 200 warm-down", same swimmers).

**Solution**: Tap the swim label on a lane card → flat, alphabetized list of common swims (100 Free, 200 Breast, 50 Kick, …) as a filtered view of `libraryDrills`; one tap selects. A "…" opens the rich editor as a back door. Never opens the rich editor for a plain pick. **The same picker serves the initial pick and appending more drills** to the active quick run ("add drill" → pick → appended as a labeled deck row, same run/swimmers/identity chain; first pick creates, later picks append — product-owner decision). Quick rows stay rep-agnostic and label-only (no description text, no stroke-count prompts — P1).

**Files**: `client/src/pages/LiveDeck.tsx`, `client/src/components/DrillEditorModal.tsx` (as needed)

**Priority**: High
**Status**: Open

---

## A-028: Fix phase-label mismatch (F-10)

**Source**: `docs/context/Sessions-Drills-Context.md` (F-10)

**Problem**: Modal offers `'main set'`/`'cool down'` (`constants/drill.ts:27`) but the deck detects `'main-set'`/`'cooldown'` (`LiveDeck.tsx:933-937`, `ProgressGroupCard.tsx:25-30`). Freshly-tagged drills never phase-group at run time.

**Solution**: Unify the vocabulary — pick one canonical set and make `PHASE_LABELS` and the deck detectors agree.

**Files**: `client/src/constants/drill.ts`, `client/src/pages/LiveDeck.tsx`, `client/src/components/ProgressGroupCard.tsx`

**Priority**: Low
**Status**: Open

---

## A-029: No modals between reps — tap-to-reset (P1)

**Source**: `docs/context/Sessions-Drills-Context.md` (Debate Outcome, P1 friction)

**Problem**: Reset between reps is gated by a confirmation dialog every time (`LiveDeck.tsx:481-490`); for an 8×100 set that's 8 dialogs. Confirmation also blocks resetting a swimmer (`LiveDeck.tsx:457-479`).

**Solution**: Tap-to-reset by default with a short hold-to-confirm affordance; remove the modal from the rep-to-rep loop. Same for clearing a swimmer's data.

**Files**: `client/src/pages/LiveDeck.tsx`

**Priority**: Medium
**Status**: Open

---

## A-030: Swimmer identity chain — no orphan lap data (P2 red line)

**Source**: `docs/context/Sessions-Drills-Context.md` (Debate Outcome, guardrail 4)

**Problem**: A timed but never-registered temp chip can leave orphan/ownerless lap rows or data locked inside synthetic `quick-…` ids — which breaks future per-swimmer progress tracking.

**Solution**: Every chip carries a synthetic id; lap rows materialize only for owner-linked swimmers (promoted to roster via `promoteAndLinkSwimmer` or completed with an owner). Untimed reps produce zero lap rows. Keep the one-motion add, enforce the identity chain.

**Product-owner decision (three-persona review)**: laps recorded under never-promoted `quick-…` ids are **retained but excluded from progress tracking until the chip is promoted** to a roster swimmer — data is never lost, but it never counts toward per-swimmer progress as orphan data.

**Files**: `client/src/context/LiveSessionContext.tsx`, `client/src/services/runService.ts`, `client/src/pages/LiveDeck.tsx`

**Priority**: Medium
**Status**: Open

---

## A-031: Drill bank scannability + interval validation (F-11/F-14)

**Source**: `docs/context/Sessions-Drills-Context.md` (F-11, F-14)

**Problem**: Bank cards render only `reps×dist stroke` — no interval/equipment/intensity — so a coach can't tell 4×100 @1:45 from @1:55. And the interval input is unvalidated free text (`DrillEditorModal.tsx:295-308`); `3:5` flows into the snapshot.

**Solution**: Show interval/equipment/intensity on bank and session drill cards. Validate interval format (and the A-020 progression syntax) on entry.

**Files**: `client/src/pages/DrillBank.tsx`, `client/src/pages/SessionDetail.tsx`, `client/src/components/DrillEditorModal.tsx`

**Priority**: Medium
**Status**: Open

---

## A-032: Drill identity — named instruction + parameterized length (no stored variants)

**Source**: `docs/context/Sessions-Drills-Context.md` (Drill Identity: Named Instruction + Parameters)

**Problem**: The drill bank fills with length-duplicates (100/200/400 free, 100/200/400 back…). The proposed "product/variant" (T-shirt/size) fix was evaluated by both personas and **rejected in its stored-variant form** (a size rack rebuilds the same explosion), but accepted as *parameterization*: product = the named instruction, length = a parameter.

**Solution**:
1. Product identity = named instruction (never stroke — "Fingertip Drag" ≠ "Fist Drill" even though both freestyle). Stroke/distance/equipment are properties.
2. **Each bank block carries a default distance** (product-owner decision) so a block is a complete grab-and-go unit for quick drill timing. One entry per instruction — the distance is a mutable default, **not a stored variant** and not the block's identity.
3. The default is remembered at pick time — **block default wins, then last-used per instruction** (not global; product-owner decision, three-persona review) — so "tap Freestyle, time 100m" stays one tap.
4. Top-level `distance` is treated as a display total / default; `items[].distance` remains the real per-rep length in session sentences (already true in `schema.ts:22-31`).
5. Complex sets (progressions, interleaves, sections) are products with no length axis — keep the rich grammar.
6. Snapshot contract (`RunDrill`) is untouched — refactor touches `LibraryDrill` only.

**Files**: `client/src/db/schema.ts`, `client/src/db/dao.ts` (library keying), `client/src/pages/DrillBank.tsx`, `client/src/pages/LiveDeck.tsx` (length picker), `client/src/utils/drillHelpers.ts`

**Priority**: Medium
**Status**: Open

---

## A-033: Per-round variation & effort grammar — descend/build/pyramid patterns (F-5)

**Source**: `docs/context/Sessions-Drills-Context.md` (F-5, Worked Example: The Pyramid Drill)

**Problem**: Per-rep variation is unrepresentable. `repeatCount` is just a count: "descend" (each rep faster), "on the 2nd iteration breathe every 7", and effort progressions like a pyramid (`100m strong / 200m medium / 300m easy / 300m strong / 200m medium / 100m easy`) have no field. The effort scale exists (`v1`–`v4`, `DrillEditorModal.tsx:281-287`) but is **unlabeled** — bare values with no legend (v1 easy → v4 hard) and no defined top end for `sprint`/`all-out` on short swims.

**Solution**:
1. **Keep the `v1`–`v4` effort scale and add `v5`** (product-owner decisions: v1 = easy → v4 = hard; **`v5` = sprint/all-out**, with the short-distance rule — typically 50m–100m). Add a visible legend in the editor and deck — today the picker shows bare `v1`–`v4` values (`DrillEditorModal.tsx:281-287`).
2. Per-rep length + effort sequence as first-class grammar: a drill's `items` are the explicit steps (each `{distance, effort, interval?}`), the stored/snapshot truth. Handles the pyramid and any irregular progression exactly.
3. Pattern shorthand as an **authoring convenience only** that expands deterministically into explicit steps (e.g. `pyramid 100/200/300/200/100`); stored form is always the explicit sequence so deck/timing/history behave identically.
4. Descend/build patterns surface as effort steps in the deck ("rep 1 → max"), not just in the drill name.
5. Per-rep labels must survive the snapshot (ties to F-2/F-16/A-021) — the two 300m pyramid reps render as distinct "300m easy"/"300m strong" rows.

**Note**: per-rep structure + runtime timing (A-025) makes a pyramid's reps independently timeable — "time just the 300m strong" is flattening + the per-rep timed/untimed flag, no new timing machinery. This largely removes the need for the saved `timingMode: 'individual' | 'continuous'` binary (`schema.ts:46`).

**Files**: `client/src/db/schema.ts`, `client/src/components/DrillEditorModal.tsx`, `client/src/services/runService.ts`, `client/src/constants/drill.ts`

**Priority**: High
**Status**: Open

---

## A-035: Drill API / data model for the set grammar (Phase 1)

**Source**: `docs/context/Sessions-Drills-Context.md` (Drill API / Data Model for the Set Grammar)

**Problem**: The drill model can't express the set grammar (progression, descend, pyramid, recovery interleave, per-round notes, named segments) and pacing is free-text `interval`. Phase 1 = make the data model + API support all variations without bloat; Phase 2 = the drill-builder UI.

**Solution**: Adopt the **base time + relative ladder** pacing model (see doc): `base?: number` (seconds, the preset/anchor) + `ladder?: number[]` (per-rep offsets; negative descends, positive builds; absent = all reps on base). Replace free-text `interval` with structured numbers — no string DSL. New `DrillItem` fields: `name`, `note` (A-021), `base`, `ladder` (pacing), `strokeLadder` (per-rep stroke-count offsets for test drills; per-swimmer `strokeBase` at run time), `rest` (fixed rest after each rep — alternative to base+ladder, mutually exclusive), `recovery?: { distance, stroke?, base?, rest?, note? }` (F-4/A-020; the recovery carries its own pacing). New **drill-level** `rounds` (per-iteration modifiers: `{ name?, note?, intensity?, equipment?, baseOffset? }`, length = `repeatCount`) — **`roundNotes` merged into `rounds[].note`**; per-round pacing is the single scalar `baseOffset` (no per-round distance — write explicit items); effective rep send-off = `lane base + ladder[rep] + round.baseOffset`. New **drill-level** `rest`. Effort scale `v1`–`v5` (A-033). **Snapshot stores RELATIVE grammar** — `createFromTemplate` persists `base` + `ladder` + the run-level lane→base map and does NOT bake in absolute send-offs; absolutes are derived by an exported `effectiveSendOff()` in `services/drillService.ts`, called by both the deck and any agent. **Structural validation lives in `services/drillService.ts`, not `dao.ts`** (DAO stays pure CRUD — A-004): numbers, ladder/rounds length = rep count, sign ranges, base+ladder vs rest exclusivity.

**Deferred (design only)**: rest countdown in the deck timers — rest-paced units run a rest countdown after the swim, send-off-paced units count down the send-off. Same timer mechanism, different "when does the next start" source.

**Phase 1 scope (API only)**: `schema.ts` DrillItem fields; `services/drillService.ts` create/update + validation + `effectiveSendOff()`; `runService.ts` relative snapshot; sections field envelope (name, phase, ordered drill refs, inter-drill `rest`) sketched in the schema. NOT included: drill-builder UI (Phase 2), per-lane run base overrides (A-034, separate), sections entity (A-024).

**Files**: `client/src/db/schema.ts`, `client/src/db/dao.ts`, `client/src/services/runService.ts`

**Priority**: High
**Status**: Open

---

## A-036: Drill dimensions — bank taxonomy for finding similar drills

**Source**: `docs/context/Sessions-Drills-Context.md` (Drill Dimensions — the bank taxonomy)

**Problem**: The bank is a flat, unscannable list (F-11/A-031) with no way to find similar drills or navigate by facet. Stroke/distance/equipment/focus/phase exist as ad-hoc fields; "type" (simple/pyramid/test/progression) isn't a facet at all.

**Solution**: A **dimensions** model — the facets coaches filter, search, and compare on: Instruction (identity/name, A-032), Stroke, Type (derived), Distance (default), Equipment, Effort (v1–v5), Focus, Phase.
1. **Type is derived, not stored** — from the grammar present (`ladder` → progression/descend, `strokeLadder` → test, `recovery` → interleave, `rounds` → round-progression, `segments` → broken). No new field, no label/structure drift.
2. **`focus` enum expands** from technique/fitness/none → + endurance / sprint / test / recovery (small enum change; the only new vocabulary). `test`, not `diagnostic` — one classifier wins (three-persona review).
3. **Bank navigation**: filter chips over dimensions + search by instruction; cards show the dimensions (extends A-031).
4. **Similar drills** = shared dimension set (same instruction = exact identity; same stroke + type + equipment = "similar") — the relationship behind the A-023 warning and bank suggestions.
5. Quick picker (A-027) and the P2 bank are the same filtered list with different default dimensions.

**Files**: `client/src/db/schema.ts` (focus enum), `client/src/utils/drillHelpers.ts` (type derivation), `client/src/pages/DrillBank.tsx`, `client/src/pages/LiveDeck.tsx` (quick picker)

**Priority**: Medium
**Status**: Open

---

## A-037: Coach-facing description on the live deck

**Source**: `docs/context/Sessions-Drills-Context.md` (Coach-facing description)

**Problem**: The drill description/notes exist end-to-end (template → snapshot → bank → session detail) but the live deck never renders them — the current-drill card shows only name + distance/stroke (`LiveDeck.tsx:262-287`), and `RunDrill.notes` (`schema.ts:78`) is never displayed. The coach at the wall — the whole point of the notes — can't read them.

**Solution (product-owner decision)**: Render `RunDrill.notes` (and rep `instructions`) as the instruction text on the deck drill card for **planned runs** — all rows (timed + untimed) share the same "instruction card" surface A-025/F-9 defines. **Quick-time rows stay label-only** — P1's deck never gains metadata clutter.

**Files**: `client/src/pages/LiveDeck.tsx` (GroupCard), `client/src/components/ProgressGroupCard.tsx`

**Priority**: Medium
**Status**: Open

---

## A-034: Per-lane pacing overrides — one drill, different send-offs per lane

**Source**: `docs/context/Sessions-Drills-Context.md` (Worked Example: The Pyramid Drill — "Two lanes, one drill")

**Problem**: Two lanes doing the same drill at different send-offs — lane 1 (stronger) swims a 3×100m pyramid at `1:45 / 1:40 / 1:35`, lane 2 at `2:00 / 1:55 / 1:50`. Coaches group lanes by ability and scale the send-off, not the structure. But the drill carries one interval string (`RunDrill.interval`, `schema.ts:80`; `DrillItem.interval`), so the deck can't show a per-lane ladder.

**Solution**:
1. **Structure is shared; pacing is per-lane and anchored to a base.** One `RunDrill` per drill — never per-lane drill snapshots. Lanes are already a runtime concept (`RunSwimmer.lane`, `LaneDrillResult.lane`, `schema.ts:87-105`); the send-off ladder is execution context, not drill identity.
2. **Base pace per lane** (threshold / CSS / T-pace-style anchor, set once): lane 1 → 1:45, lane 2 → 2:00. Squad-standard, validated against swim practice.
3. **The drill carries a relative ladder**, not absolute times — `descend 0 / −5 / −10s`, `+15s rest`, or an effort mapping (F-1 progression syntax applies to offsets). **Effective send-off per rep = lane base + ladder[rep]**, so the coach never re-enters the ladder per lane; per-lane absolute overrides remain possible when a set genuinely differs.
4. **Base can anchor both** send-off (deck pacing) and target pace (informational); send-off is what matters at the wall.
5. Entered in run setup, editable mid-run like the timed/untimed flag (A-025). The deck renders each rep row with every lane's effective send-off (lane 1: 1:45 / lane 2: 2:00).
6. **Pacing doesn't touch recorded times** — send-off is a pacing/display parameter; laps are whatever they were.
7. **Run-level execution context** (three-persona review): the lane→base map is stored at run level in the **relative** snapshot (never baked to absolutes — A-035); per-swimmer `strokeBase` for stroke-count tests (A-035) lives in the same run-level lane data.

**Files**: `client/src/db/schema.ts` (lane settings), `client/src/db/dao.ts`, `client/src/services/runService.ts`, `client/src/pages/LiveDeck.tsx`, run setup UI

**Priority**: Medium
**Status**: Open

---

## A-019: Session import/export for cross-coach sharing

**Source**: Design review — coach onboarding and sharing

**Problem**: No way to share session templates between coaches. Current alternatives (iPhone notes, verbal instruction) are fragile. The app needs a way for existing coaches to share sessions with new coaches (onboarding vector) and for coaches to trade sessions with peers.

**Solution**: File-based export/import with import namespacing.

**Export**: A session template + its drills serialized to a JSON file. Downloaded via browser.

**Import**: Parse JSON, create session + drills through existing DAO methods. Drills are tagged `source: 'imported'` with a `creatorFingerprint` (stable UUID of the exporting coach). Imports are displayed separately in the drill bank under an "Imports" tab.

**Design doc**: `docs/context/Import-Export-Context.md`

**Implementation stages**:
1. Phase 1 (onboarding): Export/download from SessionsList, import/file-pick into SessionsList. Imports tagged as `source: 'imported'`.
2. Phase 2 (peer sharing): Import namespace grouping, re-import updates from same creator, "Make Native" drill-by-drill matching UI.
3. Phase 3 (curated defaults): Maintain a collection of seed session JSON files. New coaches receive these on sign-up interest (email/AirDrop).

**Files**:
- New: `client/src/api/importExport.ts` — `exportSession()`, `importSession()` functions
- `client/src/pages/SessionsList.tsx` — Export button per card, Import button in header
- `client/src/db/schema.ts` — optional `creatorFingerprint`, `importBatchId`, `source: 'imported'` on LibraryDrill/Session
- `client/src/pages/DrillBank.tsx` — "My Drills" / "Imports" tab

**Priority**: High
**Status**: In Progress — Export/download from SessionsList and import/file-pick UI not yet implemented
