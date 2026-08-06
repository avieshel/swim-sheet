# Sessions & Drills — Session-Building Flow Context

## Purpose

Focused context for the **session-building** experience: how a coach takes a session
from their head/notebook and turns it into a SwimSheet template. Covers the drill data
model, the `DrillEditorModal` / `SessionDetail` flow, and how drills are snapshotted into
the live view.

Scope: `SessionDetail.tsx`, `SessionsList.tsx`, `DrillEditorModal.tsx`, `DrillBank.tsx`,
`db/schema.ts` (Drill/DrillItem), `db/dao.ts` (seed data), `services/runService.ts`
(createFromTemplate snapshot).

## The Reference Session

Real session supplied by a coach. This is the "can I build this easily?" bar for the flow.

### Endurance Session (sample)

**Warm-up** (~600m)
1. `2×200m` — each 200m is `50m freestyle (focus on hard kicking) / 50m fingertip drag /
   50m fist hands / 50m breathing every 5` (on the 2nd iteration breathe every 7 strokes).
   All segments are full freestyle swims with a drill/instruction emphasis — **no equipment**
   (kick = "kick hard", not a kickboard drill). Breathing-style details (e.g. freestyle
   breath vs. breaststroke breath) live in the segment/drill description.
2. `3×50m descend`
3. `50m easy`

**Main set** (~1800m)
4. `4×200m` send-off progression **4:00 → 3:55 → 3:50 → 3:45**
5. Between each 200m: `50m easy` at 1:00 pace
6. `4×100m` paddles + pull buoy @ **1:55**
7. `4×100m` paddles + pull buoy @ **1:45**

**Cool-down** (~100m)
8. `100m easy`

**Total: ~2500m**

## How This Session Maps Onto the Current Model

| # | As the coach writes it | Phase | Current-model representation | Verdict |
|---|------------------------|-------|------------------------------|---------|
| 1 | 2×200m: 50 free (hard kick focus) / 50 fingertip drag / 50 fist / 50 breathing-every-5 (2nd round breathe 7s) | warmup | `repeatCount: 2`, 4 items of 50m; needs per-segment names/notes to carry "kick hard", "breathing every 5"; no accessory on any item; round-2 variation lost | ⚠️ Partial |
| 2 | 3×50m descend | warmup | `repeatCount: 3`, item 50m freestyle; "descend" is free-text only | ⚠️ Partial |
| 3 | 50m easy | warmup | single 50m freestyle | ✅ |
| 4 | 4×200m @ 4:00→3:45 send-off | main-set | one `interval` string per item — all 4 reps get the same send-off | ❌ Broken |
| 5 | 50m easy @ 1:00 between each 200 | main-set | must be a separate drill; pairing with the 200s is lost | ❌ Broken |
| 6 | 4×100m paddles + pull buoy @ 1:55 | main-set | item `equipment: ['paddles','pullbuoy']`, `interval: '1:55'` | ✅ |
| 7 | 4×100m paddles + pull buoy @ 1:45 | main-set | same as above, different interval | ✅ (triggers similar-drill warning) |
| 8 | 100m easy | cool-down | single 100m freestyle | ✅ |

**Bottom line:** the two paddle sets and the cooldown build cleanly. The warm-up is
half-expressible (structure works, meaning is lost). The main 200m progression and the
recovery interleaves cannot be built as written today — a coach would have to create
8+ separate template drills.

## Coach's Mental Model

A coach thinks of a session as **three sections** (warm-up → main set → cool-down), each
section made of **sets/drills**. Sections are the unit a coach actually reuses:

- "My standard warm-up" (the 2×200 drill-mix above) is reused across *every* session,
  week after week, with tiny tweaks.
- A main set is usually new or adapted from a previous session ("Tuesday's 200s but
  faster send-off").
- Cool-downs are near-identical every day.

The tool's job is to make **reuse** the default. Rebuilding a section from atomic drills
every session is the friction the user reports ("I don't have an option to save the
warm-up — this forces me to repeat my settings").

### The Three-Layer Model (reuse granularity)

```
Bank (blocks)            Sections (reusable groups)    Sessions (structured whole)
"100m Freestyle"         "my standard warm-up"           "Tuesday Endurance"
one entry per            ordered blocks + phase          ordered sections + metadata
instruction, with a      (the F-8 entity)                (the template)
default distance

✅ exists today           ❌ DOES NOT EXIST              ✅ exists today
atomic AND complete —     the balance point: named,      reusable as a run, but
grab-and-go for quick     phased group of blocks the     too big to remix ("1/3 of
timing (P1)               coach reuses (P2)              it is good")
```

Each layer is reusable at its own granularity, and nothing is duplicated between layers.
**Bank blocks are atomic and complete** — one entry per named instruction with a default
distance (see "Drill Identity" below), so P1's quick timing is zero-setup ("tap Freestyle,
time 100m"). **Sections are the missing entity** — the balance point between "save just
the blocks" (too granular: reassembling the warm-up is 4 adds + ordering per session) and
"save the whole session" (too coarse: a session is a specific day; reusing it verbatim is
rare, and editing a whole template to keep one section is as much work as rebuilding).
A section is named, carries a phase (warmup/main-set/cooldown), and holds an ordered list
of blocks. This is exactly the "save the warm-up" ask. **Sessions are the structured
whole** — ordered sections + metadata, run verbatim.

## The Full Lifecycle (Create → Run → Mine)

```
PLAN                                        RUN
─────                                       ───
 Open New Session          ┌────────────┐
   │                       │  SNAPSHOT   │   start live deck
   ▼                       │  into Run   │
 ┌───────────┐  pull from  └────────────┘
 │  SECTIONS  │◄───────────   per-lane / per-drill timing is a
 │  library   │   mine good     LIVE decision:
 │  (reuse)   │   parts back      • warm-up:      untimed
 └─────┬─────┘       │            • main set:     timed (selective)
       │             │            • cool-down:    untimed
       ▼             │            • per swimmer   opt-in/out
 ┌───────────────┐   │
 │  drill bank   │   │          RUN
 │  (raw units)  │   │           │
 └───────┬───────┘   │           ▼
         │ add/copy  │      ┌─────────────────┐
         ▼           │      │  completed run   │
 ┌───────────────┐   │      │  (swimmer laps)  │
 │ SESSION        │──┼──────┘                  │
 │ warm-up        │  └─────────────────────────┘
 │ main set       │        TRACK (future):
 │ cool-down      │        progress over time feeds back
 └───────────────┘        into PLAN ("she hit 4:00, push to 3:50")
```

The loop a coach should be able to run in minutes:

1. **PLAN** — open a new session, pull in a saved warm-up section, then either pull a
   saved main-set section, mine one from a past session, or build it fresh from the bank.
   Add a cooldown section. Name it, done.
2. **RUN** — snapshot to a live run. Timing is decided *in the moment*: warm-up and
   cool-down are left untimed; only the main-set swimmers get timed. The coach can time
   a whole lane or just individual swimmers.
3. **MINE** — after the run (or from any past session), "save this section to the library"
   in one action. Next session pulls it, not its raw parts.
4. **TRACK** (future, out of scope) — per-swimmer lap data from RUN feeds progress
   charts; the loop closes back into PLAN. The run-snapshot + per-swimmer timing model
   must not be built in a way that blocks this.

Two things must be true for this loop to feel good: sections must be a first-class
reusable object (F-8), and timing must be a runtime decision rather than a baked-in drill
property (F-9).

## Personas: The Two Coaches

The app serves two very different coaches. Every UX/UI decision should be checked against
both. They are used as debate agents for design analysis (see "Debate Process" below).

### P1 — "The Deck Timer" (Timer Coach)

- **Where**: pool deck, phone in hand, wet fingers. 45–90 min sessions.
- **Goal**: clock on their swimmers within seconds. Times **everything** — every lap,
  every drill, warm-up included. To them, recorded times ARE the motivation.
- **What they never do**: design templates, tag phases, set focus/labels, use equipment
  combos. A "session" is "we're doing 8×100 free today." They reuse a handful of basic
  swims (100 free, 200 breast) forever.
- **Non-negotiables**: ≤2 taps to start timing; a plain-swim picker with no form
  complexity; timing controls always visible; add swimmers on the fly.
- **Would concede**: nothing about speed — but is fine leaving advanced session tools
  buried/hidden.

### P2 — "The Set Architect" (Session Planner)

- **Where**: laptop/tablet at home, planning the season. Pool deck is secondary.
- **Goal**: precise, complex, reproducible sessions (pyramids, IM order, send-off
  progressions, equipment sets) plus a library of reusable sections. Spot-times a few
  laps to check pace — **not** the point of the app for them.
- **What they never do**: fumble at the deck; time warm-ups; want a clock forced into
  every drill.
- **Non-negotiables**: complex sets must be expressible (F-1…F-7); sections reusable
  (F-8); timing opt-in at run time, phase-based by default (F-9).
- **Would concede**: the live deck staying simple/minimalist as long as the *plan* is
  rich and the timing is suppressible.

### P3 — "The Engineer" (API conscience)

- **Where**: between the two coaches — the architecture that serves both.
- **Goal**: an API that stays clean, minimal, and honest, because it is the **functional
  layer a future agent may call directly**. No UI-driven bloat, no dual sources of truth,
  no business logic smuggled into the DAO or the UI.
- **What they enforce**: one canonical rep stream; relative (not absolute) stored grammar
  with derived values in a service function; validation at a single service boundary;
  deterministic type derivation; explicit-vs-implicit clarity in every field.
- **Non-negotiables**: no `isQuick` API flag (quick is a UI mode over one model); the
  snapshot is never lossy; the DAO stays pure CRUD (A-004); the UI may make multiple calls
  to keep endpoints minimal.
- **Would concede**: nothing that produces a second copy of truth — resolution must be one
  function (`effectiveSendOff()`), not two implementations.

### The structural map

```
                    Timer Coach (P1)              Planner Coach (P2)
Route                /  LiveDeck                   /sessions, /drills
Unit of work         one swim, timed               session = sections of drills
Primary artifact     the clock / split times       the plan / the library
Timing default       everything, always            by phase, opt-in
Setup tolerance      ~2 taps                        minutes, but rarely
Reuse pattern        "last drill again"            "save the warm-up"
```

### Debate process (agentic)

1. Spin the personas as research agents; each independently analyzes the current app and
   produces friction points + non-negotiables + ideal flow from their persona (P1 deck,
   P2 planner, P3 engineer — see "Three-Persona Review" below).
2. Cross-examine: feed each persona the others' output; each responds as their coach —
   what they accept, what they reject, what they'd trade.
3. Moderate (synthesis): list conflicts, agreements, and the architecture that satisfies
   all three; product-owner decisions are ratifiable from the settled list.

## Friction Points

Ranked by how much they slow a coach building this session.

### F-1. Progressive send-off intervals are unsupported (blocks the whole main set)

`DrillItem.interval` is a single free-text string (`client/src/db/schema.ts:27`) edited as
one field in the modal (`client/src/components/DrillEditorModal.tsx:295-308`). When a drill
is run, `createFromTemplate` flattens individual-mode reps and gives **every rep the same
interval** (`client/src/services/runService.ts:176-196`).

"4×200 @ 4:00 → 3:45" therefore cannot be one drill. A coach must create four drills
(200@4:00, 200@3:55, 200@3:50, 200@3:45) — four modal round-trips for a single set.

**Fix direction:** let `interval` accept a progression (e.g. `4:00, 3:55, 3:50, 3:45` or
`4:00 → 3:45`), resolve per-rep at snapshot time, and display the correct send-off in the
live deck per rep.

### F-2. Set segments have no name / no instruction, so the warm-up loses its meaning

`DrillItem` carries only `distance/stroke/repeatCount/intensity/interval/equipment`
(`client/src/db/schema.ts:22-31`). `DrillSegment` has a `name` (`schema.ts:33-37`) but is
for broken sets only and is **not editable in `DrillEditorModal` at all**.

"50m freestyle (kick hard)", "50m fingertip drag", "50m fist", "50m breathing every 5"
all collapse into "50m freestyle". Both `Fingertip Drag` and `Fist Drill` already exist in
the seeded drill bank (`client/src/db/dao.ts:557,597`) — but a segment cannot reference
them, and the live deck/session list render the anonymous `4x50 freestyle`.

For the warm-up, each 50m segment is a **full freestyle swim with an instruction emphasis**
(no equipment, no stroke change). The breathing nuance ("freestyle breath vs. breaststroke
breath") is coach detail that belongs in the description — the tool only needs to carry the
short label ("kick hard", "fingertip drag", "breathing every 5") so the set is readable.

**Fix direction:** give `DrillItem` an optional `name` (short label) and `note`
(free-form instruction/description), with a picker that can link a segment to an existing
bank drill. Segments-with-names make the warm-up self-documenting on the session card and
in the live deck.

### F-3. `kickboard` is not a selectable equipment option (data inconsistency)

The equipment picker grid uses `EQUIPMENT_OPTIONS` (`client/src/constants/drill.ts:28-32`
= fins/paddles/pullbuoy/snorkel) but the DAO default list and seed data use `kickboard`
(`client/src/db/dao.ts:287,789,819`). A coach cannot select a kickboard in the modal even
though seeded drills use it.

Note: this is *not* needed for the warm-up's "kick" segment — that is a kicking-focus
freestyle with **no accessory**. The inconsistency is a separate correctness bug for
genuine kickboard drills.

**Fix direction:** add `kickboard` to `EQUIPMENT_OPTIONS` (recheck the 4-col grid layout
for 5 items) so the picker matches the data. Do **not** introduce a "kick" stroke type —
a kick-focused swim is still freestyle, expressed via the segment name/note (F-2).

### F-4. Recovery interleaves force set-splitting

"50m easy @ 1:00 between each 200m" is a paired structure: 4×(200 + 50). The model has no
concept of a recovery swim interleaved into a set, so the coach creates a separate "50m
easy" drill. The session card and live deck then show `4×200` and `4×50` as independent
drills — losing the pairing a coach sees in their head.

**Fix direction:** optional `recovery` sub-component on a drill item ("between each rep:
50m easy @ 1:00"), flattened in `createFromTemplate` as alternating reps
(200, 50, 200, 50, …) with the recovery reps tagged as easy/recovery in the live deck.

### F-5. Per-round variation is unrepresentable

`repeatCount` is just a count. "On the 2nd iteration breathe every 7 strokes" and
"descend" (each rep faster) have no field. `descend` survives only in the drill name;
the round-2 breathing change is lost entirely.

**Fix direction:** optional per-rep overrides, or at minimum a repeat-level note array
(e.g. `roundNotes: ['', 'breathe every 7']`). A `descend` intensity pattern (rep 1 → max)
is a higher-value addition.

### F-6. Session assembly is one-modal-at-a-time with no copy

Building this session today needs ~9 open-modal → fill-form → save round-trips
(`client/src/pages/SessionDetail.tsx:499-504` opens the editor; there is no duplicate
action on the drill card). For the four 200s with different intervals, a coach wants
"duplicate this, change the interval" — which doesn't exist.

Additionally the similar-drill warning fires when saving drill #7 (the intentional
4×100 @ 1:45) because it's near-identical to #6 (`client/src/pages/SessionDetail.tsx:430-439`)
— friction for *intentionally* distinct sets.

**Fix direction:** add a duplicate/copy button on each session drill row; make the
similar-drill warning smarter (warn when same name *and* same everything; allow
interval-only differences).

### F-7. Everything above compounds for the live view

`createFromTemplate` (individual mode) flattens each template drill into N `RunDrill`
rows with a `(r/n)` prefix (`client/src/services/runService.ts:176-196`). This is actually
the right model for pacing — but each rep inherits the same `interval`/`instructions`
(F-1), so the live deck can't show "rep 2 — send-off 3:55". Fixing F-1/F-4 at snapshot
time fixes the deck automatically.

### F-8. No reusable section/block entity — the "save the warm-up" gap

There are only two reuse units today: **atomic drills** (drill bank) and **whole
sessions** (templates). The unit a coach actually reuses — the section/block — doesn't
exist. Consequences:

- A coach cannot save "my standard warm-up" and pull it into tomorrow's session. They
  re-add the 4 segments (or 4 separate bank drills) and re-tag them `warmup` every time.
- There's no way to **mine a section from a past session or run** ("keep Tuesday's main
  set"). Reuse across sessions means opening the old template and re-copying drills.
- Sessions are flat lists of drills (`client/src/db/schema.ts:13-20` + ordered `drills`
  table); there's no grouping that could *be* a saved block.

The friction is structural, not a UI nicety: `Session` has no child structure between
itself and `Drill`, so there is nowhere for "the warm-up" to live as a reusable object.

**Fix direction:** introduce a section/block entity — a named, phased (warmup/main-set/
cooldown), ordered group of drills — that (a) composes into sessions, (b) can be saved to
a section library, and (c) can be created by "save section from this session/run" (mine).
This is the granularity balance point: bigger than a drill, smaller than a session.

### F-9. Timing is a runtime decision, but the model bakes it into the drill

Coach reality: **warm-ups are not timed, cool-downs are not timed, and the main set
*might* be timed — and even then, maybe not for every rep and not for every swimmer.**
Timing is decided at the wall, per drill, per lane, per swimmer.

Current model conflates three different questions into one saved binary field
(`timingMode: 'individual' | 'continuous'`, `client/src/db/schema.ts:46`):

1. **Is this drill timed at all?** — No such concept. Every drill in the live deck shows
   Start/Lap/Finish controls (`SwimmerRows.tsx`), warm-up included. There is no "untimed"
   drill, so the coach either times warm-ups (noise) or ignores the controls.
2. **How is it timed?** — `timingMode` answers this (individual reps vs continuous set),
   but it's saved on the template and only changes run-snapshot flattening
   (`runService.ts:150-197`) — it's about structure, not about whether timing happens.
3. **Who is timed?** — No per-swimmer timing opt-in. Timing is all-or-nothing per lane
   via group Start/Finish.

The phase tags (`labels: ['warmup'|'main-set'|'cooldown']` on the *template* drill) could
carry a sensible *default* ("warm-up → untimed"), but today they only drive the
Progress-Mode banner (`LiveDeck.tsx:551-559`; `ProgressGroupCard.tsx:25-30`) — they do not
affect timing at all.

**Fix direction:** split the three questions. (a) A drill's phase provides the *default*
timing intent (warm-up/cool-down → untimed; main set → timed), stored as a soft
preference, not a binary. (b) At run time the coach can mark a drill timed/untimed for a
lane, or start/stop timing individual swimmers. (c) A swimmer's per-lap record is only
created when they were actually timed — which is exactly what feeds future progress
tracking. Untimed drills render as instruction cards (no clock), timed drills render with
the clock.

### F-10…F-17 — Findings from the two-persona debate

Found by the P1 (Deck Timer) and P2 (Set Architect) agents when they walked the app as
themselves. These supplement F-1…F-9.

- **F-10 — Phase labels don't match runtime detection.** The modal offers `'main set'` /
  `'cool down'` (`PHASE_LABELS`, `constants/drill.ts:27`) but the deck detects
  `'main-set'` / `'cooldown'` (`LiveDeck.tsx:933-937`; `ProgressGroupCard.tsx:25-30`).
  Only `'warmup'` agrees. Any freshly-tagged drill won't phase-group at run time.
- **F-11 — The drill bank isn't scannable.** Cards render only `reps×dist stroke`
  (`DrillBank.tsx:285-293`) — no interval, equipment, or intensity. A coach can't tell
  4×100 @1:45 from @1:55 without opening each drill.
- **F-12 — Reps can be wedged into "steps", silently lying.** A progression or recovery
  interleave *can* be squeezed into one drill as N components, but semantics are lost
  everywhere downstream (`runService.ts:176-196`). Worse than "can't build it": it looks
  built and reads wrong.
- **F-13 — No drag-and-drop, no duplicate drill.** Docs claim drag-drop
  (`Sessions-Screen-Context.md`); code has only up/down arrows (`SessionDetail.tsx:515-529`).
  No duplicate action (`SessionDetail.tsx:581-596`) — the #1 repeated-work killer.
- **F-14 — Interval is unvalidated free text.** Bare input with placeholder `2:00`
  (`DrillEditorModal.tsx:295-308`); a typo like `3:5` flows into the run snapshot.
- **F-15 — Progress Mode still has a clock.** Untimed drills don't exist; the progress card
  still renders elapsed + Start/Complete (`ProgressGroupCard.tsx:214-285`). Timing is the
  default, not opt-in.
- **F-16 — The snapshot destroys meaning.** Per-rep flattening renders named warm-up
  segments as anonymous `50m freestyle [1/1]` rows (`runService.ts:179,188`). The plan a
  coach spent an evening making legible arrives at the deck illegible.
- **F-17 — No mining path.** Completed runs are inert rows on `SessionsList.tsx:319-357`;
  there's no "save this section from this run". Reuse = open old template, re-add by hand.

Plus the P1-only findings: no plain-swim picker (quick-start locks you to "100m Freestyle",
`runService.ts:239-242`); per-swimmer cards overloaded with stroke steppers on tiny
~12px targets (`SwimmerRows.tsx:177-185,389-397`); reset is gated by a confirmation modal
on every rep (`LiveDeck.tsx:481-490`); "Add Swimmer" is a full form when a one-touch chip
is needed; the "wanna be" badge is noise; every return to the Live tab auto-starts an
accidental session (`LiveDeck.tsx:1140-1146`); lane Start fires all swimmers at once
(no staggered start).

## Ideal Flow (target)

The full lifecycle in a few minutes:

**PLAN** — build the reference session by pulling **sections**, not raw drills:
1. **Add warm-up section** — either "save my standard warm-up" (2×200m, 4 named 50m
   segments) from the section library, or build it once and save it.
2. **Add main set** — "4×200m @ 4:00→3:45" as one drill (progression interval) with
   "50m easy @ 1:00 between reps" as a recovery component; duplicate + tweak interval for
   the two paddle sets. Mine from a past session if it already exists.
3. **Add cooldown** — one tap from the section library.
4. Sections carry their phase (warmup/main-set/cooldown) with them; the coach never
   re-tags.

**RUN** — warm-up and cool-down render as untimed instruction cards; the main set is
timed, and the coach can time just the lanes/swimmers they want.

**MINE** — "save this section to library" from any past session/run.

Each interaction is one tap/modal, not a chain of them.

## Definition of Done for This Flow

- The reference session can be entered as ~5 drills (2 warm-up, 1 main, 2 paddle) + 2
  single easy swims — never more than one drill per "coach sentence".
- Segments render with their short labels (`50m fingertip drag`, `50m kick-hard free`,
  `50m breathing every 5`) on the session card and in the live deck; free-form breathing
  detail is carried in the description.
- `kickboard` is a valid equipment option (for genuine kickboard drills); a kick *focus*
  is expressed as a freestyle segment label, not a stroke type or accessory.
- Progressive intervals resolve to per-rep send-offs in the live deck.
- Recovery swims alternate with their set reps in the live deck and are labeled easy.
- **Sections are reusable**: a coach can save the warm-up once and pull it into any new
  session, and can mine a section from a past session/run.
- **Timing is a runtime decision**: warm-up/cool-down default to untimed (instruction
  cards, no clock), main set defaults to timed, and the coach can toggle per lane or per
  swimmer mid-session. Per-swimmer timed data is what future progress tracking consumes.
- Once the model supports it, seed this exact session (see `seedDefaultSessions` in
  `client/src/db/dao.ts:771`) as a demo template.

## Debate Outcome (Two-Persona Synthesis)

Two independent agents — P1 the Deck Timer and P2 the Set Architect — analyzed the app
from their personas and then cross-examined each other. They converged (independently) on
the same architecture.

### The core insight: "100 Free" IS a Drill

There is no separate "quick swim" and "planned set". A quick swim is the **degenerate case**
of the full drill grammar: one item, one anonymous segment, no phase, no equipment. P1's
plain picker is a **filtered view of the drill bank**, not a hardcoded enum. A drill P2
built (paddles + pull buoy, send-off, breathing segments) appears in P1's flat list with
its label and is still one tap. **One substrate, two skins.**

### Two doors into the same building

| | **Quick Time** (P1's door) | **Planned Session** (P2's door) |
|---|---|---|
| Entry | deck-first, 0 taps to a clock | editor-first (sections, grammar, library) |
| Unit | one swim ("100 Free"); the **quick run accumulates drills** — "add drill" appends a pick, same swimmers | session = sections of drills |
| Timing default | **everything timed, always** | by phase: warm-up/cool-down untimed, main set timed |
| "Untimed" | structurally impossible | a per-drill/lane/swimmer runtime flag |
| Deck rendering | clock only, no metadata; each quick drill is a labeled row, add/remove anytime | structure preserved (segments, send-off ladder, recovery tags) |
| Add swimmer | one-touch chip (synthetic id) | roster-linked, promotable |

### The guardrails that make both happy

1. **Timing defaults key off how the run started.** Quick-start runs inherit
   "timed everything"; planned runs inherit phase defaults. Any drill flips timed/untimed
   with one tap mid-run. (Resolves F-9.)
2. **"Untimed" is an exception, and it can't leak into Quick Time.** P1's lane always
   shows a clock; P2's warm-up can be an instruction card on the same screen, same
   component, same run.
3. **Segment labels survive the snapshot.** `RunDrill` already carries
   `interval/instructions/equipment/parent_drill_id` (`schema.ts:71-85`); extend it so a
   planned "50m fingertip drag" renders as itself while a quick "100 Free" renders as a
   plain label. (Resolves F-2/F-7/F-16.)
4. **Every timed chip has an identity chain.** Blank chip = synthetic `quick-…` id; lap
   rows materialize only for owner-linked swimmers (promoted to roster or completed with
   an owner). Untimed reps produce zero lap rows. Future progress tracking stays clean.
5. **No modals between reps.** Tap-to-reset, big Start/Lap/Stop, no confirmation dialogs.
6. **The rich editor and section library stay first-class routes** — P1 never has to see
   them, but they are never buried to declutter the deck.

### What this unlocks (map to frictions)

- Quick Time fixes P1's entire list (plain picker, one-touch chips, no modals, no noise)
  on top of the existing A-018 quick-start foundation.
- Planned Session fixes F-8 (sections), F-1/F-4 (progression + recovery grammar),
  F-2 (named segments), F-5 (per-round notes), F-6 (duplicate), F-3 (kickboard).
- The runtime timing model (guardrail 1) is the F-9 fix, and it's persona-agnostic: the
  *default* is the only thing that differs by door.

### Remaining tension, resolved

- **Landing surface:** P1 wants the deck always; P2 wants the plan first-class. Resolution:
  root stays deck-first; Sessions/Drills remain one tap away; and **when a planned run is
  active, the deck renders its structure** (segments, send-off ladder, recovery tags) so
  P2's plan isn't erased at execution time.
- **Instruction vs. clock:** P2 insists untimed drills still show the plan as a readable
  card ("no phase banners is fine; no instruction is not"). Accepted: the untimed card is
  an *instruction* card, not an empty one.

## Drill Identity: Named Instruction + Parameters (the "recipe book")

The coach proposed an e-commerce model — drills as *products* with *variants*, like a
T-shirt with sizes: "100m Freestyle" and "200m Freestyle" are one product ("Freestyle"),
two length variants; "100m Freestyle" vs "100m Breaststroke" are different products.
Both personas evaluated it independently.

**Verdict: the instinct is right; the implementation is wrong.** The length-duplication
pain is real (F-11, A-017), but **stored variants** (a size rack) rebuilds the exact
explosion it's meant to kill, under a friendlier name.

### Why the T-shirt analogy breaks

1. **T-shirts have finite stock sizes; swims have continuous length.** Pre-loading
   "sizes" (100/200/400 × every stroke) is the 100/200/400 sprawl wearing a foreign key.
2. **A "200 free" is not "a 100 free, but longer" at the wall.** It's a different
   assignment — send-off, rep count, rest, energy system. Length is a *dose*, not a size.
3. **What the coach is describing is a bank-hygiene problem** ("don't make me create 200
   breast when 100 breast exists") — a library concern, not a deck-side concern.

### The two agreed reframes

1. **Product = the named instruction — the "subject of the sentence" — never the stroke.**
   "Fingertip Drag", "Fist Drill", "Catch-Up" are all freestyle but are three *distinct*
   products. "100 Free" and "200 Free" collapse because they share the instruction
   ("freestyle swim"); a technique drill does *not* collapse with the plain swim even
   though it shares the stroke. Stroke is a property, not identity.
2. **Length is a parameter, never a stored variant.** No variant table, no size rack. One
   recipe per named drill; the coach writes the serving size. A plain swim's length is
   *unset* on the product until the sentence (session or quick pick) supplies it.

### Why this is almost free in the current model

A drill's `items` already carry the real per-rep distance (`schema.ts:22-31`); the
top-level `distance` is a **derived display total, not structural identity**. "8×100 free"
is literally `repeatCount: 8, item.distance: 100`. So the length axis was never real
identity — collapsing it is structural, not a data migration.

### What stays off the rack

Complex sets keep the rich grammar and are their own products with no length axis:
progressions (F-1), recovery interleaves (F-4), per-round notes (F-5), named segments
(F-2), sections (F-8). A product/variant model is a flat warehouse — a send-off ladder has
no place in it.

### What it fixes

- **F-11**: the bank collapses 100/200/400 free + back + breast rows into a handful of
  named cards — scannable at a glance.
- **A-017 (length half)**: "don't make me create 200 breast when 100 breast exists" dies
  structurally — better than the dedup cleanup pass, because it's keyed by instruction.
- **Similar-drill detection**: on the length axis it becomes an exact match, not fuzzy
  logic.
- **F-2 (bonus)**: a segment like "50m fingertip drag" links to a *product* (Fingertip
  Drag) and the segment's own 50m supplies the length.
- **P1's picker**: a product list + a length control that **defaults to last-used** — the
  common case stays one tap.

### Guardrails both agreed on

1. The picker never forces a "variant" step; default to the last length used, always.
2. Named technique drills remain distinct products — identity is the instruction, never
   the stroke.
3. Equipment is a sentence parameter at the set level, never a product identity.
4. Complex sets keep the rich grammar (they are products, not variants).
5. The snapshot stays the source of truth for history — the refactor touches
   `LibraryDrill` only; runs/laps/lane results are untouched.

**The reframe:** it's not a T-shirt shop — it's a **recipe book**. One recipe per named
drill; the coach writes the serving size.

### Resolution: bank blocks carry a default distance (product-owner decision)

Open question — does a bank drill carry a length, or is it unset until the sentence
supplies it? — resolved by the product owner: **the bank is a library of concrete,
grab-and-go building blocks, so each block carries a distance** (e.g. "100m Freestyle"),
enabling zero-setup quick drill timing. This does not resurrect the variant problem:

- **One entry per named instruction, never N length rows.** "Freestyle" is one block; its
  distance is a *default* (a number), not an identity and not a variant.
- **Default ≠ identity.** Identity is the instruction ("freestyle swim"); the distance is
  the block's grab-and-go length. Dropping the block into a session *sentence* supplies
  its own length via `items`, overriding the default.
- **The default is remembered.** Quick Time's length control defaults to the block's
  stored distance, then to the last-used length — "tap Freestyle, time 100m" stays one tap.

**The three-layer model (confirmed):**

```
Bank (blocks)         Sections (reusable groups)    Sessions (structured whole)
"100m Freestyle"        "my standard warm-up"          "Tuesday Endurance"
one entry per           ordered blocks + phase         ordered sections + metadata
instruction, with a     (the F-8 entity)                (the template)
default distance
```

Blocks are atomic and complete — grab-and-go for quick timing. Sections are the reusable
middle layer (F-8): save once, pull anywhere, mine from past runs. Sessions are the
structured whole composed of sections. Each layer is reusable at its own granularity, and
nothing is duplicated between layers.

## Drill Dimensions — the bank taxonomy

Coaches find drills by **navigating, not scrolling** — every drill carries a small set of
**dimensions** (the facets to filter, search, and compare on). These are the properties of
the identity model (A-032) made navigable:

| Dimension | Values | Source |
|---|---|---|
| Instruction | "Freestyle", "Fingertip Drag", "Pyramid" | identity — the name (A-032) |
| Stroke | free / back / breast / fly / IM | `stroke` |
| Type / pattern | simple / progression / descend / pyramid / interleave / test / broken | **derived** from the grammar |
| Distance | default length | block default (A-032) |
| Equipment | none / fins / paddles / pullbuoy / snorkel / kickboard | item `equipment` |
| Effort | v1–v5 | item `intensity` |
| Focus / purpose | technique / fitness / endurance / sprint / test / recovery | `focus` (enum expands) |
| Labels (facets) | catch, rotation, breathing, body position, kick, streamline, rhythm, strength, endurance, speed, pacing, sprint, aerobic, anaerobic, pullout, recovery, feel, balance, power, efficiency | `labels` (free-form, multi-value) |
| Phase | warmup / main-set / cooldown | `labels` |

- **Similar drills** = drills sharing a dimension set: same instruction (exact identity),
  or same stroke + type + equipment — the relationship behind the similar-drill warning
  (A-023) and bank suggestions.
- **Bank navigation** = filter chips over the dimensions (stroke, type, equipment, phase,
  focus) + search by instruction. Cards show the dimensions (extends A-031/F-11).
- **Type is derived, not stored.** "Pyramid", "test", "progression" come from the grammar
  present: `ladder` → progression/descend; `strokeLadder` → test; `recovery` → interleave;
  `rounds` → round-progression; `segments` → broken set. One less field, no drift between
  a drill's label and its actual structure.
- **`focus` expands** from technique/fitness/none to add endurance / sprint / test /
  recovery — a small enum change, and the only genuinely new vocabulary.
- **No parallel taxonomy.** Dimensions are views over existing fields plus the derived
  type; nothing is stored twice (anti-bloat).

The quick picker (A-027) and the P2 bank are the **same filtered list** with different
default dimensions — P1 sees plain swims first, P2 sees everything.

## Worked Example: The Pyramid Drill (complex sets + partial timing)

A coach wants a pyramid: `100m strong / 200m medium / 300m easy / 300m strong / 200m
medium / 100m easy` — the classic mirror, where effort tracks distance (shortest =
strongest, longest = easiest). This is the stress test for the complex-set grammar and for
"can I time just one part?"

### One drill = one coach sentence

The pyramid is a single drill whose `items` are the six per-rep steps, each carrying a
**length** and an **effort label**. It is exactly the F-1/F-5 per-rep grammar, not a new
concept:

- **Explicit steps (the stored/snapshot truth):** six items, each `{distance, effort}`.
  Handles any irregular progression exactly — including this mirror-image pyramid.
- **Pattern shorthand (authoring convenience only):** P2 types `pyramid 100/200/300/200/100`
  on the laptop and it expands deterministically into the explicit steps. The shorthand is
  just an input mode; what's stored and snapshotted is always the explicit sequence, so the
  deck, timing, and history behave identically either way.

### Keep the v-scale, add the v5 top end (product-owner decisions)

The pyramid expresses per-rep effort on the **v-scale**: `v1 = easy → v4 = hard`, with
`sprint` / `all-out` reserved for short swims (typically 50m–100m) — the scale the modal
already ships (`DrillEditorModal.tsx:281-287`). Validation against swim practice: numbered
effort scales are standard in the sport (training zones 1–5/1–7, RPE 1–10), and the
"sprint/all-out = short swims" rule is well-supported (FORM goggles: "Max efforts are
typically short swims"; zone guides: Zone 5 / VO₂max = 50–200m sprint). The named-label
systems (Easy/Moderate/Strong/Fast/Max) express the same ladder in words.

So the pyramid maps directly: `100m strong / 200m medium / 300m easy` → `v3 / v2 / v1`
on the way up, mirrored on the way down. Two product-owner decisions settle the open ends:

1. **Add a fifth marker `v5` = sprint / all-out** (the A-033 top end) with the short-distance
   rule (typically 50m–100m). It is a real effort level, not notes — so it feeds the A-036
   effort dimension for bank filtering.
2. **The scale needs its legend everywhere it renders** — today v1–v4 appear as bare picker
   values (`DrillEditorModal.tsx:281-287`); the editor and deck show the mapping
   (v1 easy … v5 all-out). Concrete addition to the F-5/A-033 work.

### Timing just the "300m strong": yes, and it's structural

In `individual` mode, `createFromTemplate` already flattens each rep into its own
`RunDrill` row (`runService.ts:176-196`) — the pyramid arrives at the deck as six
independently-timed rows. Nothing new is needed for per-rep timing; it exists today. What
makes "time only rep 4" work is the F-9 runtime-timing model:

```
Deck (planned pyramid run):
  1  100m strong    (instruction row — no clock)
  2  200m medium    (instruction row)
  3  300m easy      (instruction row)
  4  300m strong    ◉ timed — clock on   ← just this one
  5  200m medium    (instruction row)
  6  100m easy      (instruction row)
```

The coach marks only rep 4 as timed; the rest render as instruction cards. Untimed reps
produce zero lap rows (guardrail 4), so future progress tracking stays clean.

### Two wrinkles worth naming

1. **The two 300s are distinct reps.** "300m easy" and "300m strong" need distinguishable
   labels in the deck — the F-2/F-16 guardrail ("segment labels survive the snapshot").
   Without per-rep labels, the flattening renders both as anonymous `(3/6)`/`(4/6) 300m`
   rows.
2. **This kills the `continuous`/`individual` binary.** A pyramid should always keep
   per-rep structure; the only real question is *which reps get a clock* — a runtime
   decision (F-9). The saved `timingMode` field largely becomes unnecessary: structure is
   always per-rep, timing is per-rep-at-runtime.

### Two lanes, one drill — pacing is per-lane, anchored to a base

Same pyramid, two lanes: lane 1 (stronger) on `1:45`, lane 2 on `2:00`. Both lanes do
3×100m; each lane's reps descend from its own base (`base, base−5s, base−10s` → lane 1:
1:45/1:40/1:35, lane 2: 2:00/1:55/1:50). This is how coaches group by ability — the
**structure is shared, pacing is per-lane and anchored to a base**.

- **Base pace per lane** — the lane's anchor, set once ("lane 1 on 1:45s"). Realistic and
  standard: this is threshold / CSS / T-pace-style reference pace, and squads split lanes
  by ability with different bases. (Validated: CSS-pace sets "8×100 @ CSS + 15s rest",
  T-pace send-offs "4×100 @ t-pace +10s", descending sets "reduce 1-4 from 60% to max".)
- **The drill carries a relative ladder, not absolute times** — `descend 0 / −5 / −10s`,
  or `+15s rest`, or an effort mapping. Effective send-offs = `base + ladder[rep]`.
- The coach never re-enters the ladder per lane — set the base, the drill's relative
  structure applies to every lane. Per-lane absolute overrides remain possible when a set
  genuinely differs.
- **Base can anchor both** send-off (when to leave — what the deck pacing uses) and
  target pace (how fast to swim — informational); send-off is what matters at the wall.
- The deck shows each rep row with every lane's effective send-off (lane 1: 1:45 /
  lane 2: 2:00). Set in run setup, adjustable mid-run like the timed/untimed flag (A-025).

This reinforces the architecture: **send-off/pacing is execution context, not drill
identity** — P2 builds the sentence once with relative offsets; per-lane base paces are
decided where the run happens (F-9).

The pyramid is a strong proof case for the model: it's one sentence, it stays one sentence,
it flattens to per-rep rows the coach can time selectively, and it never produces orphan
data.

## Drill API / Data Model for the Set Grammar (Phase 1)

The goal: the drill model expresses every variation in this document with the **minimum
set of fields**. Pacing is the core addition. The snapshot stores **relative** grammar
(`base` + `ladder` + run-level lane→base map); absolutes are derived by an exported
`effectiveSendOff()` at render time — never baked into the snapshot (three-persona review:
a second absolute copy would drift, and mid-run lane-base edits would leave it stale).

### The core: base time + relative ladder

Every paced unit has a **base time** (the preset/reference, in seconds) and optionally a
**relative ladder** (per-rep offsets from base). Effective rep send-off =
`(lane base override ?? item.base) + ladder[rep]`.

- **Simple drill**: base only → all reps on base ("8×100 @ 2:00" = base 120).
- **Descend**: base + ladder `[0, −5, −10, …]`. "Descend by 5s" is the authoring
  shorthand that writes this ladder; the stored truth is always base + offsets. Lane 1
  base 1:45 → 1:45/1:40/1:35; lane 2 base 2:00 → 2:00/1:55/1:50. One drill, two levels.
- **Custom**: any ladder ("2:00, 1:50, 2:00" → base 2:00, ladder [0, −10, 0]).
- **Sign convention**: negative = tighter/faster (descend), positive = build/rest.
- **Absolute ladders need no separate form**: base = rep-1 send-off, offsets relative to it.

The base is the lane-scaling anchor (A-034): at run time a lane's base overrides the
drill's, offsets unchanged. The editor may display absolute send-offs (base + offset);
the stored form stays relative.

### DrillItem (schema)

| Field | Kind | Maps to |
|---|---|---|
| id, distance, stroke, repeatCount | existing | |
| intensity?: 'v1'…'v5' | existing | per-rep effort; v5 = sprint/all-out (A-033, short-distance rule) |
| equipment?: string[] | existing | |
| segments?: DrillSegment[] | existing | broken sets |
| name?: string | **new** | A-021 short segment label |
| note?: string | **new** | A-021 instruction/description |
| base?: number | **new** | preset/base time (seconds) — the pacing anchor |
| ladder?: number[] | **new** | per-rep offsets from base; absent = all reps on base |
| strokeLadder?: number[] | **new** | per-rep stroke-count offsets for test drills; effective = swimmer `strokeBase` + strokeLadder[rep] |
| rest?: number | **new** | fixed rest (seconds) after each rep — alternative to base+ladder on that item; mutually exclusive |
| recovery?: { distance: number; stroke?: string; base?: number; rest?: number; note?: string } | **new** | F-4/A-020 between-rep recovery swim; `base`/`rest` give the recovery its own pacing, `note` a label |

`interval?: string` (free text) is **replaced** by `base` + `ladder` — no string DSL, no
parsing; validation (A-031) is structural (numbers, ladder length = rep count, sign range).

### How each variation maps

| Variation | Representation |
|---|---|
| Simple drill (8×100 @ 2:00) | repeatCount 8, base 120 |
| Descend (4×200 @ 4:00→3:45) | repeatCount 4, base 240, ladder [0, −5, −10, −15] |
| Pyramid (3×100, two lanes) | repeatCount 3, base 105 (lane 2 overrides to 120), ladder [0, −5, −10] |
| Big pyramid (100/200/300/300/200/100) | six items, repeatCount 1 each: distance + intensity + base + offsets |
| Recovery interleave (4×(200 + 50 easy)) | item 200 base 240 + recovery { distance: 50 }; flatten alternates |
| Named warm-up segments | items with name + note (A-021) |
| Per-round change ("2nd round breathe every 7") | rounds [ {}, { note: 'breathe every 7' }, … ] |
| Per-lane scaling | run lane base override (A-034), offsets untouched |
| Effort pyramid | per-item intensity (v1–v5) across the steps |
| Stroke-count test (10×50, +1 stroke/rep) | repeatCount 10, timed reps + strokeLadder [0, +1, …, +9]; per-swimmer stroke base at run |
| Round-progression set (3× pyramid: long strokes / fast pace / paddles+buoy) | items [100, 200, 400], repeatCount 3, rounds [{name:'long strokes'}, {name:'fast pace', intensity:'v4'}, {name:'gear', equipment:['paddles','pullbuoy']}] |
| Fixed-rest set (100m v4, 20s rest) | item {distance:100, intensity:'v4', rest:20}; deck runs a rest countdown after each rep |
| Rest between drills | drill-level `rest?: number` (seconds after the drill, before the next in the session) |

### Round-level modifiers — per-iteration variation

A coach runs `3 × (100m / 200m / 400m)` where each iteration differs: round 1 "long
strokes", round 2 "fast pace", round 3 "paddles + pull buoy" — a classic
progressive-overload set (technique → effort → gear). The pyramid steps (100/200/400)
are `items`; the "×3" is `repeatCount`; the per-iteration difference is the missing piece.

Current grammar covers per-**item** variation (length, effort, equipment) but not
per-**round** variation across a multi-item drill — every iteration of `repeatCount` is
identical today.

**Fix (minimal):** optional `rounds` on the drill, one modifier per iteration:

```
rounds?: {
  name?: string        // 'long strokes' / 'fast pace' / 'gear'
  note?: string        // per-round note — roundNotes merged here ("breathe every 7")
  intensity?: string   // v1–v5, applies to all items in the round
  equipment?: string[] // applies to all items in the round; overrides item equipment
  baseOffset?: number  // round-level pacing offset (seconds): lane base + ladder[rep] + round.baseOffset
}[]
```

- `rounds.length` = `repeatCount` (validation). Absent = all iterations identical
  (current behavior — no change for existing drills).
- Flattening (`createFromTemplate`): for each round, for each item → rep row carrying the
  round's name/intensity/equipment, so round 3 renders as paddles + pull buoy rows.
- Same "ladder" pattern as pacing / stroke count, but at the drill level.
- **`roundNotes` merged into `rounds[].note`** (three-persona review): per-iteration notes
  ("breathe every 7" on the 2nd) are a round property, not a separate field.
- **Rounds stay bounded — no distance, no per-round ladder** (product-owner decision,
  three-persona review): per-round pacing is the single scalar `baseOffset`; per-round
  distance means writing explicit items — `rounds` is a modifier, not a second `items`
  grammar.
- The round `note` must survive flattening onto the deck rep rows ("2nd iteration breathe
  every 7" rendered on rep 2) — storage hygiene is not allowed to reopen the F-16
  legibility wound.
- **Alternative with no new structure**: write the set as 9 flat items (each round's items
  carry their own intensity/equipment) — fully expressible, but the session card and deck
  lose the "3× pyramid" grouping and the pyramid is re-entered 3×.

### The stroke-count test drill ("find your sweet spot")

A coach runs `10×50m`, each rep one stroke more than the last (starting low), timing every
rep and counting strokes. Purpose: find the swimmer's **sweet spot** — the stroke
count/rate where adding a stroke stops buying speed (speed = stroke rate × distance per
stroke; the balance point is the "critical stroke rate"). Standard, well-documented
practice (stroke-rate ladders, DPS tests, SWOLF). Validated against swim coaching
literature.

The model mirrors the pacing ladder exactly:

- **Structure**: 10×50m freestyle, reps timed — the F-9 per-rep timing already covers it.
- **Prescription**: `strokeLadder` = relative offsets (`[0, +1, …, +9]`), one per rep.
  Because the sweet spot is individual, the **base stroke count is per-swimmer** at run
  time (same shape as lane base for pacing): effective target = `swimmer strokeBase +
  ladder[rep]`, stored as `strokeBase` in the swimmer's per-lane run data (the same
  run-level execution context as the lane→base map). The "start low, add 1 per rep"
  shorthand writes the ladder.
- **Recording**: per-rep time (existing lap timing) + per-rep stroke count — `Lap.stroke_count`
  already exists (`schema.ts:157`). Nothing new to store.
- **"Test" is not a new type.** It's the same drill grammar with a stroke ladder + timed
  reps; the deck (Phase 2) prompts a stroke-count entry per timed rep **in planned/test
  runs only — never in quick picks** (P1 red line). A `focus: 'test'` label marks it for
  grouping/display (`diagnostic` rejected — three-persona review: one word wins).
- **The sweet-spot analysis is future** (TRACK): compare per-rep `time` and `stroke_count`
  (SWOLF = time + strokes; lowest = most efficient). The API only carries the prescription
  and records the measurements — no computation in the API (anti-bloat).

### Rest vs send-off — recovery specification

Coaches specify recovery two ways, both standard (e.g. "4×100 (20") rest" vs
"4×100 @ 2:00 send-off"):

- **Send-off (interval)** — wall-to-wall cadence: "8×100 @ 2:00". Rest is whatever's left
  after the swim. This is the current `base` + `ladder` pacing.
- **Fixed rest** — a recovery timer: "100m v4, then 20s rest". Rest is explicit; the
  send-off is implicit (varies with swim time).

Two views of the same gap; the model supports both as **alternatives**:

- **Per-rep rest**: `rest?: number` on `DrillItem` — fixed rest after each rep of the item.
  Mutually exclusive with `base`/`ladder` on that item (validation: a paced unit uses one
  or the other; a mixed set switches between them via multiple items or rounds).
- **Rest between drills**: drill-level `rest?: number` — fixed rest after this drill,
  before the next in the session (minimal form; alternative is a session-order rest entry).

**Recovery carries its own pacing** (three-persona review): `recovery?: { distance,
stroke?, base?, rest?, note? }` — "50m easy @ 1:00 between each 200" is expressible as a
recovery with its own `base` (or `rest`) plus a `note`, not a nested `DrillItem`. Bounded:
no recursion.

**Interleave count is explicit authoring** (product-owner decision): "4×200 with 50m easy
between each" reads as N−1 or N recoveries depending on the coach ("between each" vs "plus a
trailing 50 after the last"). The author chooses **between / after / both** (or a count) —
the engine never guesses from prose.

**Timer incorporation (DEFERRED — design only, not implemented)**: when a rep or drill is
rest-paced, the deck timer runs a **rest countdown** after the swim ends so the coach knows
when to send the next rep/drill; for send-off-paced units the countdown is the send-off.
Rest and send-off countdowns are the same timer mechanism with a different "when does the
next one start" source — the deck shows both, whichever the unit is paced by.

### Coach-facing description — the "describe the drill to the team" notes

Verified status:

- **Stored**: `Drill.description` (template, `schema.ts:49`), `LibraryDrill.description`
  (bank, `schema.ts:145`), carried into the run snapshot as `RunDrill.notes`
  (`schema.ts:78`; `createFromTemplate` copies it, `runService.ts:173,192`). All 26
  seeded bank drills carry a description (`dao.ts:339-489`).
- **Editable**: `DrillEditorModal` description field (`DrillEditorModal.tsx:109-110`).
- **Shown**: bank cards + detail (`DrillBank.tsx:278,431`); session drill rows
  (`SessionDetail.tsx:537-538`).
- **GAP**: not rendered on the **live deck** — the current-drill card shows name +
  distance/stroke (`LiveDeck.tsx:262-287`) but neither `RunDrill.notes` nor the rep
  `instructions`. The coach at the wall — the whole point of the notes — can't read them.
- **Fix (product-owner decision)**: render `RunDrill.notes` as the instruction text on the
  deck drill card for **planned runs** — all rows (timed + untimed) share the same
  "instruction card" surface A-025/F-9 defines for untimed drills. **Quick-time rows stay
  label-only** so P1's deck never gains metadata clutter. (Recorded as A-037.)

### Deliberately NOT added (anti-bloat)

- No string DSL for intervals — structured numbers only.
- No per-swimmer targets — pacing is per-lane; swimmer-specific goals are future.
- No sections here — sections are a separate entity (A-024).
- **No per-rep equipment/stroke overrides** — legal granularity (three-persona review):
  equipment/stroke may vary at the **round axis** (`rounds[].equipment`) and the
  **recovery axis** (`recovery.stroke`); per-*rep* overrides are illegal — a genuinely
  mixed set uses multiple items or rounds. (Reworded from "equipment is set-level": round
  and recovery already override; the rule is about reps.)
- No `timingMode` rework — timing stays a runtime decision (A-025); the saved binary is
  deprecated but not reworked here.
- **Quick mode is a UI mode, not an API flag** (three-persona review): no `isQuick` field —
  appends are `addRunDrill`, the deck advances reps manually, and a quick run never mutates
  the shared default session.
- **Snapshot stays RELATIVE** (three-persona review): `createFromTemplate` stores
  `base` + `ladder` + the run-level lane→base map — it does NOT resolve to absolute
  per-rep send-offs (two copies would drift, and mid-run lane-base edits would leave them
  stale). Absolutes are derived by an exported `effectiveSendOff()` service function that
  the deck and any future agent call; mining a section from a past run is a **copy** of the
  relative grammar, not a rebuild.

### Phasing

- **Phase 1 (API only, current focus)**: `schema.ts` DrillItem fields; **structural
  validation moves out of `dao.ts` into a new `services/drillService.ts`** (DAO stays pure
  CRUD — A-004; strengthened by the append-heavy quick flow: every write path, planned
  create or quick append, validates at one service boundary); `runService.ts` stores the
  relative snapshot and `drillService` exports `effectiveSendOff()`. The sections field
  envelope (name, phase, ordered drill refs, inter-drill `rest`) is sketched in the schema
  so Phase 1 doesn't close it off; the sections entity itself builds in A-024.
- **Phase 2 (later)**: drill-builder UI that starts simple (base time) and progressively
  reveals descend / custom ladder / recovery / named segments / effort — never more
  complex than the coach's current step needs.

## Three-Persona Review — friction settled (rounds 1–2)

After the two-persona debate converged, a third persona was added — **P3 "The Engineer"**
(keeps the API clean and functional: the API is the functional layer a future agent calls
directly; the UI may make multiple calls; business logic lives in services, never in UI or
DAO). All three ran an independent review of this design (round 1), then cross-examined
each other's findings (round 2).

### Round-1 frictions (what the personas found)

- **P1 (deck):** (a) auto-start leaves create-vs-append undefined; (b) quick rows must be
  lap-anytime — no rep auto-advance; (c) A-030 could drop laps on never-promoted temp chips;
  (d) no pacing UI on quick rows; (e) no filter chips on the deck picker; (f) A-037
  description must not clutter quick rows; (g) length-memory priority; (h) stroke-count
  prompts must never reach quick picks; (i) the two doors must not become a launch chooser.
- **P2 (planner):** (a) a lossy absolute snapshot kills per-lane scaling and mining; (b)
  recovery interleaves can't carry their own pace; (c) sections copy-vs-reference + phase
  precedence; (d) mining must rebuild relative ladders; (e) rounds can't vary distance or
  pacing; (f) "descend" is two meanings (send-off vs effort); (g) sprint top-end of the
  v-scale; (h) lock the sections schema contract in Phase 1.
- **P3 (engineer):** (a) effective-send-off resolution has no home; (b) dual `repeatCount`
  indexing axis undefined; (c) `roundNotes` and `rounds` are two mechanisms for one axis;
  (d) the "no per-rep overrides" anti-bloat rule contradicts `rounds[].equipment` +
  `recovery.stroke`; (e) type derivation needs a deterministic classifier; (f) recovery too
  thin; (g) `strokeLadder` per-swimmer base has no storage home; (h) validation belongs in
  services, not DAO.

### Round-2 settlement — engineering (no owner input)

- **Relative snapshot** — `createFromTemplate` stores `base`+`ladder`+lane→base map;
  absolutes derived by exported `effectiveSendOff()` (deck and agents call the same
  function). Mining = a copy. (Closes P2-a/d, P3-a.)
- **Quick mode is a UI mode** — no API flag; append = `addRunDrill`; the deck advances reps
  manually; quick runs never mutate the shared default session. (Closes P1-b at the model
  level.)
- **`roundNotes` merged into `rounds[].note`**; rounds gain `baseOffset` (single scalar,
  composes `lane base + ladder[rep] + round.baseOffset`); **no per-round distance** (write
  items explicitly). (Closes P2-e, P3-c/d.)
- **Recovery gains `{ base?, rest?, note? }`** — bounded, no recursion. (Closes P2-b, P3-f.)
- **`strokeBase` in per-swimmer lane data**; the focus classifier picks **`test`**, not
  `diagnostic`. (Closes P3-e/g.)
- **Validation in `services/drillService.ts`**, not DAO. (Closes P3-h.)
- **Sections field envelope sketched in Phase 1**; the entity builds in A-024. (Closes P2-h.)
- **Descend shorthand** is authoring sugar expanding to stored form (A-033).

### Round-2 settlement — product-owner decisions (all 8 ratified)

| Decision | Verdict |
|---|---|
| Auto-start row | **First pick creates row #1, subsequent picks append** (never replace) |
| Laps on never-promoted temp chips (A-030) | **Retained, excluded from progress tracking until the chip is promoted** |
| Description on the deck (A-037) | **Planned rows show it (timed + untimed); quick rows are label-only** |
| Effort top end (A-033) | **Add `v5` = sprint/all-out** (short-distance rule, ~50–100m) |
| Recovery interleave count | **Explicit authoring control** (between / after / both) — engine never guesses |
| Round modifiers | **Pacing offset only** (`baseOffset`); distance stays in explicit items |
| Sections (A-024) | **Copy-on-pull** (library canonical); **section phase wins** for timing defaults |
| Length memory (A-032) | **Block default wins**, then last-used per instruction (not global) |

## Related

- Data model: `docs/context/DB-Context.md`
- UI/system context: `docs/context/UI-Context.md`
- Session screen: `docs/context/Sessions-Screen-Context.md`
- Drill bank screen: `docs/context/Drills-Screen-Context.md`
