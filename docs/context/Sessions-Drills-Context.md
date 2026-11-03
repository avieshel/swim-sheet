# Sessions & Drills — Session-Building Flow Context

## Purpose

> **Drill and session model.** The domain model lives in two focused files:
> `docs/context/Drill-Model-Context.md` (schema, drill identity, the two repeat
> levels, canonical notation) and `docs/context/Session-Model-Context.md` (plan,
> decomposition, rest/recovery, what the agent cannot set). This file keeps the
> session-building flow, the reference session, the coach personas, and the
> friction/gap list.

Focused context for the **session-building** experience: how a coach takes a session
from their head/notebook and turns it into a SwimSheet template. Covers the drill data
model, the `DrillEditorModal` / `SessionDetail` flow, and how drills are snapshotted
into the live view.

Scope: `SessionDetail.tsx`, `SessionsList.tsx`, `DrillEditorModal.tsx`, `DrillBank.tsx`,
`db/schema.ts` (Drill/DrillItem), `db/dao.ts` (seed data + `DEFAULT_EQUIPMENT`),
`services/runService.ts` (`createFromTemplate` snapshot).

**Status note**: this file is maintained current-state — the reference session, the
mapping table, the open friction list (F-1…F-17), the settled design decisions, and the
pacing-grammar design are canonical; resolved debates are kept as one-line resolutions.

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
distance, so P1's quick timing is zero-setup ("tap Freestyle, time 100m"). **Sections are
the missing entity** — the balance point between "save just the blocks" (too granular) and
"save the whole session" (too coarse). A section is named, carries a phase
(warmup/main-set/cooldown), and holds an ordered list of blocks. **Sessions are the
structured whole** — ordered sections + metadata, run verbatim.

## The Full Lifecycle (Create → Run → Mine)

1. **PLAN** — open a new session, pull in a saved warm-up section, then either pull a
   saved main-set section, mine one from a past session, or build it fresh from the bank.
   Add a cooldown section. Name it, done.
2. **RUN** — snapshot to a live run. Timing is a runtime decision: warm-up and cool-down
   can be left untimed; only chosen swimmers get timed (F-9 is resolved — see below).
3. **MINE** — after the run (or from any past session), "save this section to the
   library" should be a one action item. Next session pulls it, not its raw parts
   (still missing — F-8/F-17).
4. **TRACK** (future, out of scope) — per-swimmer lap data from RUN feeds progress
   charts; the loop closes back into PLAN. The run-snapshot + per-swimmer timing model
   must not be built in a way that blocks this.

Two things make this loop feel good: sections as a first-class reusable object (F-8) and
timing as a runtime decision (F-9 — resolved).

## Personas: The Coaches

Every UX/UI decision is checked against both coaches; P3 is the architecture conscience.
They are used as debate agents for design analysis.

### P1 — "The Deck Timer" (Timer Coach)

- **Where**: pool deck, phone in hand, wet fingers. 45–90 min sessions.
- **Goal**: clock their swimmers within seconds. Times everything — recorded times ARE
  the motivation. Reuses a handful of basic swims (100 free, 200 breast) forever.
- **Non-negotiables**: ≤2 taps to start timing; a plain-swim picker with no form
  complexity; timing controls always visible; add swimmers on the fly; no modals between
  reps.
- **Would concede**: nothing about speed — but is fine leaving advanced session tools
  buried/hidden.

### P2 — "The Set Architect" (Session Planner)

- **Where**: laptop/tablet at home, planning the season. Pool deck is secondary.
- **Goal**: precise, complex, reproducible sessions (pyramids, IM order, send-off
  progressions, equipment sets) plus a library of reusable sections.
- **Non-negotiables**: complex sets must be expressible (F-1…F-7); sections reusable
  (F-8); timing opt-in at run time (F-9).
- **Would concede**: the live deck staying simple/minimalist as long as the *plan* is
  rich.

### P3 — "The Engineer" (API conscience)

- **Goal**: an API that stays clean, minimal, and honest — the functional layer a future
  agent may call directly. No UI-driven bloat, no dual sources of truth, no business
  logic in the DAO or the UI.
- **Enforces**: one canonical rep stream; relative (not absolute) stored grammar with
  derived values in a service function; validation at a single service boundary;
  deterministic type derivation; explicit-vs-implicit clarity in every field.
- **Non-negotiables**: no `isQuick` API flag (quick is a UI mode over one model); the
  snapshot is never lossy; the DAO stays pure CRUD (A-004). Resolution must be one
  function (`effectiveSendOff()`), not two implementations.

## Design Decision: "100 Free" IS a Drill (settled)

There is no separate "quick swim" and "planned set". A quick swim is the **degenerate
case** of the full drill grammar: one item, minimal attributes, no phase, no equipment.
**One substrate, two skins.** Quick Time attaches to a session template (today, the
default quick template) and appends drills as real `RunDrill` rows — no parallel model.

| | **Quick Time** (P1's door) | **Planned Session** (P2's door) |
|---|---|---|
| Entry | deck-first (`/` LiveDeck), 1 tap to a clock | editor-first (`/sessions`, sections, grammar, library) |
| Unit | one swim ("100 Free"); the quick run accumulates drills | session = sections of drills |
| Deck rendering | clock + labeled rep rows, add/remove anytime | plan structure preserved per rep rows |
| Add swimmer | one-touch chip (synthetic id) | roster-linked, promotable |

**Guardrails**: the rich editor and section library stay first-class routes even when P1
never sees them; when a planned run is active the deck renders its structure so P2's plan
isn't erased at execution time; untimed drills can still render as instruction cards
("no phase banners is fine; no instruction is not").

## Friction Points — the OPEN gap list

Ranked by how much they slow a coach building the reference session. Each has been
re-verified against the current code.

### F-1. Progressive send-off intervals are unsupported (blocks the whole main set)

`DrillItem.interval` is a single free-text string (`client/src/db/schema.ts`) edited as one
small field in the modal (`client/src/components/DrillEditorModal.tsx`). When a drill is
run, `createFromTemplate` flattens individual-mode reps and gives **every rep the same
interval** (`client/src/services/runService.ts`).

"4×200 @ 4:00 → 3:45" therefore cannot be one drill — a coach must create four drills
(four modal round-trips for one set). **Fix direction:** resolve per-rep send-offs at
snapshot time (progression/explicit steps — see the pacing-grammar design below) and
display the correct send-off in the live deck per rep.

### F-2. Warm-up segments lose their meaning (partially mitigated by F-16)

`DrillItem` carries `distance/stroke/repeatCount/intensity/interval/equipment/
description/segments` — it has **no short `name`/`note` per step**, and the drill-level
`focus`/`labels` live on the drill, not per segment. Dedicated `DrillSegment` has a
`name` (`db/schema.ts`) but is for broken sets only and is not editable in
`DrillEditorModal`.

"50m freestyle (kick hard)", "50m fingertip drag", "50m fist", "50m breathing every 5"
still collapse into "50m freestyle". `Fingertip Drag` and `Fist Drill` exist in the bank —
but a segment cannot carry its instruction emphasis on the session simple-row surface.
The v1 `description` field (F-16) is the partial bridge: AI drafts carry the technique
text per step; the hand editor has a technique input too.

**Fix direction:** per-step short labels that render on the session card and the deck
(the per-step `description` gets the free-form breathing detail); a segment picker that
can link to an existing bank drill.

### F-3. Kickboard picker/data mismatch (residual)

`EQUIPMENT_OPTIONS` (`client/src/constants/drill.ts`) = fins/paddles/pullbuoy/snorkel —
no `kickboard`. The DAO `DEFAULT_EQUIPMENT` constant **does** include `kickboard` (and
`zoomers`). The former seeded-bank kickboard drills are gone (the bank now seeds from
`client/src/data/drills.json`, which contains no kickboard), so only the **picker vs
equipment-vocabulary mismatch** remains: a coach cannot select a kickboard in the editor.

**Fix direction:** align the picker with the equipment vocabulary (`kickboard`, `zoomers`)
instead of carrying two lists. This is *not* needed for the warm-up "kick" segment — a
kick-focused freestyle carries no accessory (F-2). Do **not** introduce a "kick" stroke
type.

### F-4. Recovery interleaves force set-splitting

"50m easy @ 1:00 between each 200m" is a paired structure: 4×(200 + 50). The model has no
concept of a recovery swim interleaved into a set, so the coach creates a separate "50m
easy" drill and the session card/deck show `4×200` and `4×50` as independent drills —
losing the pairing. **Fix direction:** optional `recovery` sub-component on a drill item
(see the pacing/recovery design below); flattened in `createFromTemplate` as alternating
reps tagged easy/recovery.

### F-5. Per-round variation is unrepresentable

`repeatCount` is just a count. "On the 2nd iteration breathe every 7 strokes" and
"descend" (each rep faster) have no field; `descend` survives only in the drill name.
**Fix direction:** per-rep/per-round modifiers (see the pacing-grammar design: ladder or
round notes).

### F-6. Session assembly is one-modal-at-a-time with no duplicate

Building the reference session needs ~9 open-modal → fill-form → save round-trips; there
is **no duplicate/copy action** on a session drill row (`SessionDetail.tsx`), so "4×200
@ each send-off" and "the 4×100s @ 1:55 vs 1:45" each demand a full re-entry. The
similar-drill warning additionally fires for *intentionally* distinct sets (#7 vs #6).
**Fix direction:** duplicate button per drill row; smarter similar-drill warning (warn on
same name *and* everything; allow interval-only differences).

### F-7. Everything above compounds at the snapshot

`createFromTemplate` (individual mode) flattens each template drill into N `RunDrill`
rows with a `(r/n)` prefix. That is the right model for pacing — but each rep inherits
the same `interval`/`instructions` (F-1/F-2), so the deck can't show "rep 2 — send-off
3:55". Fixing F-1/F-4 at snapshot time fixes the deck automatically.

### F-8. No reusable section/block entity — the "save the warm-up" gap

Only two reuse units exist today: **atomic drills** (drill bank) and **whole sessions**
(templates). The unit a coach actually reuses — the section — doesn't exist:

- A coach cannot save "my standard warm-up" and pull it into tomorrow's session.
- There is no "mine a section from a past session or run" path. Reuse means opening the
  old template and re-copying drills.
- Sessions are flat ordered drill lists (`Session` + `drills` table); there is no
  grouping that could *be* a saved block.

The friction is structural, not a UI nicety. **Fix direction:** introduce a section/block
entity — a named, phased group of drills — that (a) composes into sessions, (b) is
saved into a section library, and (c) can be created by "save section from this
session/run". Bigger than a drill, smaller than a session.

### Resolved items (kept for history; not open)

- **F-9 — timing baked into the drill model.** RESOLVED by removal: the
  `timingMode: 'individual' | 'continuous'` field (and continuous mode) was removed
  (Oct 2026). Drills always unroll to one `RunDrill` per rep in `createFromTemplate`;
  whether a rep gets a clock is a deck-side runtime decision. The three historical
  questions ("is this drill timed at all / how / who") are answered by the runtime
  timing model and the never-auto-start deck rework — any remaining piece
  ("warm-up defaults to untimed instruction cards") hangs off the phase labels, not a
  saved timing binary. The core blocker (a saved 'continuous' collapse) cannot regress.
- **F-10 — phase labels vs runtime detection.** SUPERSEDED. The phase banner and
  `ProgressGroupCard` were removed in the Overview/Timing split (and Overview mode
  itself was later replaced by the LiveDeck/ActiveRunView live UI). The canonical label
  vocabulary today is `PHASE_LABELS = ['warmup', 'pre-set', 'main set',
  'cool down', 'taper']` (`client/src/constants/drill.ts`). Future phase-default-timing
  work should read these labels as names, not parse renamed runtime strings.
- **F-15 — Progress Mode still has a clock.** SUPERSEDED with F-10: Progress Mode is
  gone. Timing is opt-in per drill in the live deck; show the clock only where the
  coach opted in.

### F-11…F-17 — Findings from the persona review

- **F-11 — The drill bank isn't fully scannable.** Drill cards render primarily
  `reps×dist stroke`; interval/equipment/intensity detail requires opening the drill.
  Verify current `DrillBank.tsx` rendering before considering this fixed.
- **F-12 — Reps can be wedged into "steps", silently lying.** A progression or recovery
  interleave *can* be squeezed into one drill as N components, but semantics are lost
  downstream. Worse than "can't build it": it looks built and reads wrong.
- **F-13 — No drag-and-drop, no duplicate drill.** Code has only up/down reordering and
  no duplicate action (`SessionDetail.tsx`) — the #1 repeated-work killer (dup. F-6).
- **F-14 — Interval is unvalidated free text.** Bare input in the editor
  (`DrillEditorModal.tsx`); a typo like `3:5` flows into the run snapshot. The AI-draft
  path has a stricter interval regex (see the AI appendix), but the human editor does not
  share it.
- **F-16 — The snapshot can destroy meaning.** PARTIALLY RESOLVED: `DrillItem.description`
  now exists (`db/schema.ts`) — AI drafts carry per-step technique descriptions and the
  human editor exposes a technique input — and `RunDrill.notes`/`instructions`/`interval`
  render on the deck iteration rows (`components/live/DrillsSection.tsx`). Residual:
  hand-authored drills that only use the drill-level description still flatten; unnamed
  warm-up segments (F-2) remain anonymous on card surfaces that don't render the per-step
  text.
- **F-17 — No mining path.** Completed runs are inert rows in the history list; there's
  no "save this section from this run". Reuse = open the old template, re-add by hand.
- **P1 residuals worth tracking:** no staggered lane start (Start fires all swimmers at
  once). The other older P1 notes (accidental auto-start, reset confirmation on every
  rep) were fixed by the LiveDeck/never-auto-start rework.

## Ideal Flow (target)

The full lifecycle in a few minutes:

**PLAN** — build the reference session by pulling **sections**, not raw drills:
1. **Add warm-up section** — either "save my standard warm-up" (2×200m, 4 named 50m
   segments) from the section library, or build it once and save it.
2. **Add main set** — "4×200m @ 4:00→3:45" as one drill (progression interval) with
   "50m easy @ 1:00 between reps" as a recovery component; duplicate + tweak interval for
   the two paddle sets. Mine from a past session if it already exists.
3. **Add cooldown** — one tap from the section library.
4. Sections carry their phase with them; the coach never re-tags.

**RUN** — warm-up and cool-down render as untimed instruction cards; the main set is
timed, and the coach times just the lanes/swimmers they want.

**MINE** — "save this section to library" from any past session/run.

## Definition of Done for This Flow

- The reference session can be entered as ~5 drills + 2 single easy swims — never more
  than one drill per "coach sentence".
- Segments render with their short labels (`50m fingertip drag`, `50m kick-hard free`,
  `50m breathing every 5`) on the session card and in the live deck; free-form breathing
  detail is carried in the description.
- Kickboard is selectable wherever the equipment vocabulary includes it — one list, not two.
- Progressive intervals resolve to per-rep send-offs in the live deck.
- Recovery swims alternate with their set reps in the live deck and are labeled easy.
- **Sections are reusable**: save the warm-up once, pull it into any new session; mine
  a section from a past session/run.
- Timing is a runtime decision: the coach can time per drill/lane/swimmer; per-swimmer
  timed data is what future progress tracking consumes.
- Once the model supports it, seed this exact session as a demo template.

## Drill Identity: Named Instruction + Parameters (the "recipe book")

The coach proposed an e-commerce model — drills as *products* with *variants*, like a
T-shirt with sizes: "100m Freestyle" and "200m Freestyle" are one product with two length
variants; "100m Freestyle" vs "100m Breaststroke" are different products.

**Verdict (settled): the instinct is right; the implementation is wrong.** The
length-duplication pain is real, but **stored variants** (a size rack) rebuild the exact
explosion it's meant to kill, under a friendlier name.

### Why the T-shirt analogy breaks

1. T-shirts have finite stock sizes; swims have continuous length. Pre-loading sizes is
   the sprawl wearing a foreign key.
2. A "200 free" is not "a 100 free, but longer" at the wall — it's a different
   assignment (send-off, rep count, rest, energy system). Length is a *dose*, not a size.
3. What the coach is describing is a bank-hygiene problem — a library concern, not a
   deck-side concern.

### The two reframes (both agreed)

1. **Product = the named instruction — never the stroke.** "Fingertip Drag", "Fist
   Drill", "Catch-Up" are all freestyle but are three *distinct* products. "100 Free" and
   "200 Free" collapse because they share the instruction; a technique drill does *not*
   collapse with the plain swim even though it shares the stroke. Stroke is a property,
   not identity.
2. **Length is a parameter, never a stored variant.** No variant table, no size rack.
   One recipe per named drill; the coach writes the serving size.

### Why this is almost free in the current model

A drill's `items` already carry the real per-rep distance; the top-level `distance` is a
**derived display total, not structural identity**. "8×100 free" is literally
`repeatCount: 8, item.distance: 100`. So the length axis was never real identity —
collapsing it is structural, not a data migration.

### What it fixes

- **F-11**: the bank collapses 100/200/400 rows into a handful of named cards.
- **Length-duplication pain**: "don't make me create 200 breast when 100 breast exists"
  dies structurally — keyed by instruction.
- **Similar-drill detection**: on the length axis it becomes an exact match, not fuzzy.
- **F-2 (bonus)**: a segment like "50m fingertip drag" links to a *product* (Fingertip
  Drag) and the segment's own 50m supplies the length.
- **P1's picker**: a product list + a length control that **defaults to last-used** —
  the common case stays one tap.

### Resolution: bank blocks carry a default distance (product-owner decision)

The bank is a library of concrete, grab-and-go building blocks, so **each block carries a
distance** (e.g. "100m Freestyle"), enabling zero-setup quick drill timing:

- **One entry per named instruction, never N length rows.** "Freestyle" is one block; its
  distance is a *default* (a number), not an identity and not a variant.
- **Default ≠ identity.** Identity is the instruction; the distance is the block's
  grab-and-go length. Dropping the block into a session supplies its own length via
  `items`, overriding the default.
- **The default is remembered.** Quick Time's length control defaults to the block's
  stored distance, then to the last-used length.

**Guardrails both agreed on**: the picker never forces a "variant" step; named technique
drills remain distinct products; equipment is a sentence parameter, never a product
identity; complex sets keep the rich grammar; the snapshot stays the source of truth for
history.

**The reframe:** it's not a T-shirt shop — it's a **recipe book**. One recipe per named
drill; the coach writes the serving size.

## Drill Dimensions — the bank taxonomy

Coaches find drills by **navigating, not scrolling** — every drill carries a small set of
**dimensions** (the facets to filter, search, and compare on):

| Dimension | Values | Source |
|---|---|---|
| Instruction | "Freestyle", "Fingertip Drag", "Pyramid" | identity — the name |
| Stroke | free / back / breast / fly / IM | `stroke` |
| Type / pattern | simple / progression / descend / pyramid / interleave / test / broken | **derived** from the grammar |
| Distance | default length | block default |
| Equipment | none / fins / paddles / pullbuoy / snorkel (vocabulary also carries kickboard/zoomers) | item `equipment` |
| Effort | v1–v5 | item `intensity` |
| Focus / purpose | technique / fitness / endurance / sprint / test / recovery | `focus` (enum expands) |
| Labels (facets) | catch, rotation, breathing, body position, kick, streamline, rhythm, strength, endurance, speed, pacing, aerobic, anaerobic, pullout, recovery, feel, balance, power, efficiency | `labels` |
| Phase | warmup / pre-set / main set / cool down / taper (`PHASE_LABELS`) | `labels` |

- **Similar drills** = drills sharing a dimension set (same instruction, or same stroke +
  type + equipment) — the relationship behind the similar-drill warning and bank
  suggestions.
- **Bank navigation** = filter chips over the dimensions + search by instruction.
- **Type is derived, not stored.** "Pyramid", "test", "progression" come from the
  grammar present. One less field, no drift between a drill's label and its structure.
- **No parallel taxonomy.** Dimensions are views over existing fields plus the derived
  type; nothing is stored twice (anti-bloat).
- The quick picker and the P2 bank are the **same filtered list** with different default
  dimensions — P1 sees plain swims first, P2 sees everything.

## Worked Example: The Pyramid Drill (design — not yet code)

> Everything from here through the pacing-grammar section is **design, not
> implementation**: the current `DrillItem` schema has no `base/ladder/recovery/rounds`
> fields. These sections are the canonical target grammar when F-1/F-4/F-5 land.

A coach wants a pyramid: `100m strong / 200m medium / 300m easy / 300m strong / 200m
medium / 100m easy` — the classic mirror, where effort tracks distance (shortest =
strongest, longest = easiest). This is the stress test for the complex-set grammar and
for "can I time just one part?"

### One drill = one coach sentence

The pyramid is a single drill whose `items` are the six per-rep steps, each carrying a
**length** and an **effort label**. It is exactly the F-1/F-5 per-rep grammar, not a new
concept:

- **Explicit steps (the stored/snapshot truth):** six items, each `{distance, effort}`.
  Handles any irregular progression exactly — including this mirror-image pyramid.
- **Pattern shorthand (authoring convenience only):** P2 types `pyramid 100/200/300/200/100`
  and it expands deterministically into the explicit steps. What's stored and
  snapshotted is always the explicit sequence, so the deck, timing, and history behave
  identically either way.

### The v-scale (product-owner decisions)

The pyramid expresses per-rep effort on the **v-scale**: `v1 = easy → v4 = hard`, with
`sprint`/`all-out` reserved for short swims (typically 50m–100m) — the scale the editor
already ships, plus:

1. **Add a fifth marker `v5` = sprint / all-out** with the short-distance rule. A real
   effort level, not notes — it feeds the effort dimension for bank filtering.
2. **The scale needs its legend everywhere it renders** — v1–v5 appear as bare picker
   values today; the editor and deck should show the mapping (v1 easy … v5 all-out).

Validation: numbered effort scales are standard in the sport (training zones 1–5/1–7,
RPE 1–10); "max efforts are short swims" is well-supported across zone guides.

### Timing just the "300m strong" (design)

Now that per-rep flattening is universal, the pyramid arrives at the deck as six
independently-timed rows. What makes "time only rep 4" work is per-rep timing control:

```
Deck (planned pyramid run):
  1  100m strong    (instruction row — no clock)
  2  200m medium    (instruction row)
  3  300m easy      (instruction row)
  4  300m strong    ◉ timed — clock on   ← just this one
  5  200m medium    (instruction row)
  6  100m easy      (instruction row)
```

Untimed reps produce zero lap rows, so future progress tracking stays clean.

### Two wrinkles worth naming

1. **The two 300s are distinct reps.** "300m easy" and "300m strong" need distinguishable
   labels in the deck — the F-2/F-16 guardrail ("segment labels survive the snapshot").
2. **Structure is always per-rep; timing is per-rep-at-runtime.** A pyramid should never
   collapse; the only real question is *which reps get a clock*.

### Two lanes, one drill — pacing is per-lane, anchored to a base

Same pyramid, two lanes: lane 1 (stronger) on `1:45`, lane 2 on `2:00`. Both lanes do
3×100m; each lane's reps descend from its own base. Coaches group by ability — **the
structure is shared, pacing is per-lane and anchored to a base**.

- **Base pace per lane** — the lane's anchor, set once ("lane 1 on 1:45s"). Realistic and
  standard: this is threshold / CSS / T-pace-style reference pace, and squads split lanes
  by ability with different bases.
- **The drill carries a relative ladder, not absolute times** — `descend 0 / −5 / −10s`,
  or `+15s rest`, or an effort mapping. Effective send-offs = `base + ladder[rep]`.
- The coach never re-enters the ladder per lane — set the base once; the drill's relative
  structure applies to every lane. Per-lane absolute overrides remain possible when a set
  genuinely differs.
- **Base can anchor both** send-off (when to leave) and target pace (how fast to swim —
  informational); send-off is what matters at the wall.
- The deck shows each rep row with every lane's effective send-off. Set in run setup,
  adjustable mid-run.

This reinforces the architecture: **send-off/pacing is execution context, not drill
identity**.

## Drill API / Data Model for the Set Grammar (design — not yet code)

The goal: the drill model expresses every variation in this document with the **minimum
set of fields**. The snapshot stores **relative** grammar (`base` + `ladder` + run-level
lane→base map); absolutes are derived by an exported `effectiveSendOff()` at render time —
never baked into the snapshot (a second absolute copy would drift, and mid-run lane-base
edits would leave it stale).

### The core: base time + relative ladder

Every paced unit has a **base time** (the preset/reference, in seconds) and optionally a
**relative ladder** (per-rep offsets from base). Effective rep send-off =
`(lane base override ?? item.base) + ladder[rep]`.

- **Simple drill**: base only → all reps on base ("8×100 @ 2:00" = base 120).
- **Descend**: base + ladder `[0, −5, −10, …]`. "Descend by 5s" is authoring shorthand;
  the stored truth is always base + offsets.
- **Custom**: any ladder ("2:00, 1:50, 2:00" → base 2:00, ladder [0, −10, 0]).
- **Sign convention**: negative = tighter/faster (descend), positive = build/rest.
- **Absolute ladders need no separate form**: base = rep-1 send-off, offsets relative to it.

### DrillItem (proposed fields)

| Field | Kind | Maps to |
|---|---|---|
| id, distance, stroke, repeatCount | existing | |
| intensity?: 'v1'…'v5' | existing | per-rep effort; v5 = sprint/all-out (short-distance rule) |
| equipment?: string[] | existing | |
| description?: string | existing | per-step technique description (F-16) |
| segments?: DrillSegment[] | existing | broken sets |
| name?: string | **new** | short segment label (F-2) |
| base?: number | **new** | preset/base time (seconds) — the pacing anchor |
| ladder?: number[] | **new** | per-rep offsets from base; absent = all reps on base |
| strokeLadder?: number[] | **new** | per-rep stroke-count offsets for test drills; effective = swimmer `strokeBase` + strokeLadder[rep] |
| rest?: number | **new** | fixed rest (seconds) after each rep — alternative to base+ladder on that item; mutually exclusive |
| recovery?: { distance, stroke?, base?, rest?, note? } | **new** | F-4 between-rep recovery swim; carries its own pacing and label |

`interval?: string` (free text) is **replaced** by `base` + `ladder` — no string DSL, no
parsing; validation is structural (numbers, ladder length = rep count, sign range).

### How each variation maps

| Variation | Representation |
|---|---|
| Simple drill (8×100 @ 2:00) | repeatCount 8, base 120 |
| Descend (4×200 @ 4:00→3:45) | repeatCount 4, base 240, ladder [0, −5, −10, −15] |
| Pyramid (3×100, two lanes) | repeatCount 3, base 105 (lane 2 overrides to 120), ladder [0, −5, −10] |
| Big pyramid (100/200/300/300/200/100) | six items, each distance + intensity + base + offsets |
| Recovery interleave (4×(200 + 50 easy)) | item 200 base 240 + recovery { distance: 50 }; flatten alternates |
| Named warm-up segments | items with name (F-2), description carries the breathing detail |
| Per-round change ("2nd round breathe every 7") | rounds [ {}, { note: 'breathe every 7' }, … ] |
| Per-lane scaling | run lane base override, offsets untouched |
| Effort pyramid | per-item intensity (v1–v5) across the steps |
| Stroke-count test (10×50, +1 stroke/rep) | repeatCount 10, timed reps + strokeLadder [0, +1, …, +9]; per-swimmer stroke base at run |
| Round-progression set (3× pyramid: long strokes / fast pace / paddles+buoy) | items [100, 200, 400], repeatCount 3, rounds [{name:'long strokes'}, {name:'fast pace', intensity:'v4'}, {name:'gear', equipment:['paddles','pullbuoy']}] |
| Fixed-rest set (100m v4, 20s rest) | item {distance:100, intensity:'v4', rest:20}; deck runs a rest countdown after each rep |
| Rest between drills | drill-level `rest?: number` (seconds after the drill, before the next in the session) |

### Round-level modifiers — per-iteration variation

A coach runs `3 × (100m / 200m / 400m)` where each iteration differs: round 1 "long
strokes", round 2 "fast pace", round 3 "paddles + pull buoy". The pyramid steps are
`items`; the "×3" is `repeatCount`; the per-iteration difference is the missing piece.

**Fix (minimal):** optional `rounds` on the drill — one modifier per iteration: `name?`,
`note?` (per-round note — roundNotes merged here), `intensity?`, `equipment?`, and a
single scalar `baseOffset?` (round-level pacing offset). Rules:

- `rounds.length = repeatCount` (validation). Absent = all iterations identical (current
  behavior — no change for existing drills).
- Flattening: for each round, for each item → rep row carrying the round's
  name/intensity/equipment.
- **Rounds stay bounded — no distance, no per-round ladder** (product-owner decision):
  per-round distance means writing explicit items — `rounds` is a modifier, not a second
  `items` grammar.
- The round note must survive flattening onto the deck rep rows — storage hygiene is not
  allowed to reopen the F-16 legibility wound.
- **Alternative with no new structure**: write the set as 9 flat items — fully
  expressible, but the session card and deck lose the "3× pyramid" grouping.

### The stroke-count test drill ("find your sweet spot", design)

`10×50m`, each rep one stroke more than the last, timing every rep and counting strokes.
Purpose: find the swimmer's **sweet spot** — the stroke count/rate where adding a stroke
stops buying speed (speed = stroke rate × distance per stroke; the balance point is the
"critical stroke rate"). Standard practice (stroke-rate ladders, DPS tests, SWOLF).

- **Structure**: 10×50m freestyle, reps timed — per-rep rows already exist.
- **Prescription**: `strokeLadder` = relative offsets (`[0, +1, …, +9]`), per-rep.
- **Base stroke count is per-swimmer** at run time: effective target = `swimmer
  strokeBase + ladder[rep]` — the same run-level execution context as the lane→base map.
- **Recording**: per-rep time + per-rep stroke count — `Lap.stroke_count` already exists.
- **"Test" is not a new type.** Same grammar with a stroke ladder + timed reps; a
  `focus: 'test'` label marks it for grouping/display (`diagnostic` rejected — one word
  wins). The deck prompts a stroke-count entry per timed rep **in planned/test runs only
  — never in quick picks** (P1 red line).
- **Sweet-spot analysis is future** (TRACK): compare per-rep `time` and `stroke_count` is
  (SWOLF = time + strokes; lowest = most efficient). The API carries the prescription and
  records the measurements — no computation in the API (anti-bloat).

### Rest vs send-off — recovery specification

Coaches specify recovery two ways, both standard:

- **Send-off (interval)** — wall-to-wall cadence: "8×100 @ 2:00". Rest is whatever's left
  after the swim. This is the current `base` + `ladder` pacing.
- **Fixed rest** — a recovery timer: "100m v4, then 20s rest". Rest is explicit; the
  send-off is implicit (varies with swim time).

Both are supported as **alternatives**:

- **Per-rep rest**: `rest?: number` on `DrillItem` — mutually exclusive with
  `base`/`ladder` on that item (a mixed set switches via multiple items or rounds).
- **Rest between drills**: drill-level `rest?: number`.

**Recovery carries its own pacing**: `recovery?: { distance, stroke?, base?, rest?,
note? }` — bounded, no recursion, not a nested `DrillItem`.

**Interleave count is explicit authoring** (product-owner decision): "4×200 with 50m
easy between each" reads as N−1 or N recoveries depending on the coach. The author
chooses **between / after / both** (or a count) — the engine never guesses from prose.

**Timer incorporation (deferred — design only)**: when a rep or drill is rest-paced, the
deck timer runs a **rest countdown** after the swim ends; for send-off-paced units the
countdown is the send-off. Same timer mechanism, different "when does the next one start"
source.

### Deliberately NOT added (anti-bloat)

- No string DSL for intervals — structured numbers only.
- No per-swimmer targets — pacing is per-lane; swimmer-specific goals are future.
- No per-rep equipment/stroke overrides — equipment/stroke may vary at the **round axis**
  and the **recovery axis**; per-*rep* overrides are illegal — a genuinely mixed set uses
  multiple items or rounds.
- Quick mode stays a UI mode, not an API flag — no `isQuick` field; appends are
  `addRunDrill`; the deck advances reps manually; a quick run never mutates the shared
  default session.
- **Snapshot stays RELATIVE**: `createFromTemplate` stores `base` + `ladder` + the
  run-level lane→base map — it does NOT resolve to absolute per-rep send-offs.
  Absolutes are derived by an exported `effectiveSendOff()` service function the deck
  and any future agent call; mining a section from a past run is a **copy** of the
  relative grammar, not a rebuild.

### Phasing

- **Phase 1 (API only)**: `DrillItem` fields; structural validation moves out of `dao.ts`
  into `services/drillService.ts` (DAO stays pure CRUD — every write path validates at
  one service boundary); `runService` stores the relative snapshot and `drillService`
  exports `effectiveSendOff()`. The sections field envelope (name, phase, ordered drill
  refs, inter-drill `rest`) is sketched so Phase 1 doesn't close it off; the sections
  entity itself is separate work.
- **Phase 2 (later)**: drill-builder UI that starts simple (base time) and progressively
  reveals descend / custom ladder / recovery / named segments / effort — never more
  complex than the coach's current step needs.

## Three-Persona Review — settled decisions

After the two-persona debate converged, P3 "The Engineer" was added and all three ran an
independent review, then cross-examined each other. The engineering settlement (no owner
input) is reflected above (relative snapshot; rounds/recovery bounded; validation in
services; sections envelope sketched). The product owner ratified these 8 decisions:

| Decision | Verdict |
|---|---|
| Auto-start row | **First pick creates row #1, subsequent picks append** (never replace) |
| Laps on never-promoted temp chips | **Retained, excluded from progress tracking until the chip is promoted** |
| Description on the deck | **Planned rows show it (timed + untimed); quick rows are label-only** |
| Effort top end | **Add `v5` = sprint/all-out** (short-distance rule, ~50–100m) |
| Recovery interleave count | **Explicit authoring control** (between / after / both) — engine never guesses |
| Round modifiers | **Pacing offset only** (`baseOffset`); distance stays in explicit items |
| Sections | **Copy-on-pull** (library canonical); **section phase wins** for timing defaults |
| Length memory | **Block default wins**, then last-used per instruction (not global) |

## Related

- Data model: `docs/context/DB-Context.md`
- UI/system context: `docs/context/UI-Context.md`
- Session screen (SessionsList / SessionDetail): `docs/context/UI-Context.md`
- Drill bank screen (DrillBank): `docs/context/UI-Context.md`
- Quick-start flow: `docs/context/Quick-Start-Context.md`

## AI session drafts (v1)

- The AI drafting flow (route `/sessions/ai`, page `AiSessionDraft`) turns a sanitized plain-language request into a complete, editable, discardable `Session` draft. It is the only sign-in-gated feature; anonymous users see a sign-in-required state and no request is sent.
- The harness Edge Function (`supabase/functions/ai-session-harness/`) verifies the caller's JWT, enforces a private per-user rate limit (`public.ai_request_record`), makes one structured-output provider call, and validates the response. The provider key is a Supabase secret; the browser never sees it. The function separates the LLM-facing **agent** (`agent/`: prompt, provider adapter, output validation) from the **harness** (`harness/`: an injectable `createHandler(deps)` for auth, rate limit, and response mapping, wired by `index.ts`). Both sides are unit-tested with fakes (`agent/*_test.ts`, `harness/handler_test.ts`; run `deno task test` in the function directory — it grants `--allow-env` for the two `PROVIDER_*` tunables only). Upstream provider throttling (429) maps to a client rate-limit response that echoes `retry_after_seconds` (plus a `Retry-After` header); a provider 503 maps to `provider_unavailable`. The harness validates the inbound request at the trust boundary — prompt length, seed shape, and context bounds (group names, equipment ids, recent sessions) — rejecting malformed input with 400; the client runs the same validator on the request it builds before sending.
- **The provider is chosen entirely by env**, with no code change: `PROVIDER_BASE_URL`, `PROVIDER_API_KEY`, `PROVIDER_MODEL`, plus two tunables that fall back to their `agent/config.ts` defaults when unset or non-positive — `PROVIDER_MAX_TOKENS` (4096) and `PROVIDER_TIMEOUT_MS` (25000). The timeout is overridable because a large model on local hardware can legitimately need minutes to emit a full draft; see `.env.functions.example` and the README's local-development section.
- **The system prompt embeds a complete, valid example draft**, generated by `buildExampleResult` from the shared config rather than hand-written. The prompt previously described the inner draft as `{ ... }`, which left weaker models to guess that `session` was an object rather than a bare string — a guess the strict validator then rejected with `502 invalid_provider_response`. Because the example is derived from `defaultSessionDraftConfig` and uses only equipment the context actually enables, it cannot drift out of contract; `agent/prompt_test.ts` asserts the example validates and that the prompt embeds it verbatim.
- **The example must demonstrate the two-level shape, not merely be valid.** A one-drill/one-item example is ambiguous: models read `items` as "the things in this drill" and then nest whole drills inside an item, which arrives as `draft.drills[N].items[M] has an unsupported field` (an item carrying `name` and its own nested `items`). `buildExampleResult` therefore emits at least two drills with one drill holding multiple items, and the prompt states outright that *"An item is never a drill"* — named steps belong in `drills`, not `items`. Tests pin both properties, because a valid example alone does not prevent the confusion.
- **The system prompt embeds a generated JSON Schema** (`shared/sessionDraft/schema.ts`, via `buildDraftJsonSchema`) ahead of the worked example, with a `description` on every field. The prompt previously described the shape in prose, which models elided or guessed at — the failure modes were `session` emitted as a bare string, drills nested inside `items`, and unknown fields on items. The schema is derived from `defaultSessionDraftConfig`, so its enums and bounds cannot drift from what the validator enforces; `schema.test.ts` walks the schema against the prompt example and asserts the two reject the same inputs. Descriptions carry semantics rather than types: the two levels of repeat count, when to split one repeat from another, and that a drill must never nest inside an item. When the context enables no equipment the `equipment` description says so explicitly, rather than silently listing the full allowlist.
- **A schema governs shape, not the refusal decision.** With the schema embedded, a varied-intensity request produced a textbook three-item draft at v1/v2/v4, while a terse-but-complete request (`4 x 100m freestyle, the last one with fins.`) still returned `not_actionable`. The over-eager `not_actionable` threshold is a separate decision boundary and needs its own treatment; more structural context does not fix it.
- **The prompt carries explicit decomposition rules**, because choosing the wrong repeat-count level is the most frequent failure. A drill's `repeatCount` repeats the whole block of steps; a step's repeats that one step. Worked cases, pinned by `prompt_test.ts`: `"400m warmup"` is one drill; `"3 x 100m"` is one drill with the step's `repeatCount` set to 3 and the drill left at 1; `"2* 300, first at 2:00 per 100m, second with paddles at 1:50 per 100m"` is ONE drill at `repeatCount: 2` holding two 300m steps. Effort, recovery and equipment are always per step, never per drill — a block whose steps differ is exactly what the step level exists for.
- **Known looseness: the interval regex is not end-anchored on its first branch.** `INTERVAL_RE` in `shared/sessionDraft/validate.ts` is `/^(?:\d{1,2}:\d{2})|(?:RI\s*\d{1,3}\s*(?:s|min|m)?)$/i`, and alternation binds looser than the anchors, so it parses as `(^\d{1,2}:\d{2})|(RI…$)`. A model answering `"2:00 per 100m"` therefore passes validation and the trailing text is stored and displayed as the interval. Tightening it would reject such drafts outright rather than clean them, so it is left alone pending a decision.
- **Repeat counts are valid at either level.** `"10 x 100"` may arrive as one item with `repeatCount: 10`, or as a drill with `repeatCount: 10` holding a single item of `repeatCount: 1`. Both are contract-valid and render identically, because `draftDrillDistance` multiplies item distance × item repeats × drill repeats. The panel surfaces the two levels as "Set repeats" and "Reps".
- **The prompt follows the coach's language for prose, keeps names canonical.** Plan lines and drill descriptions are written in the language the coach wrote in (a Hebrew prompt gets Hebrew sentences); drill names stay in canonical English so they match the library catalogue. Production (2026-11-01) drafted from a Hebrew prompt into fully English output. This is a deliberate middle path, chosen so library matching survives while the coach reads their own terms — revisit if coaching feedback says otherwise.
- **The session name is only allowed to quote numbers the coach stated.** Production (2026-11-01) named the session "Mixed Technique and Endurance 4000" while the drills summed to 2600 m. The prompt forbids inventing or mis-deriving numbers; there is no validator for this (it is a semantic judgment), so it is enforced by prompt + eval review only.
- **Canonical drill notation** (`shared/sessionDraft/format.ts`). `formatDrillLine` renders a drill as one line: `Main set | 2 sets | 100m freestyle x3 v2 @1:30 +fins`. It has two jobs: it is the matching vocabulary for rendering the drill library so a coach's phrasing can be compared against a concrete line rather than prose, and `describeDraftProblem` turns a validator failure into a sentence an agent can act on — naming the offending step, the offending field names, listing the fields a step may carry, or naming the permitted strokes/intensities. Format tests pin the exact output so the notation cannot drift.
- **The live retry loop uses the same actionable advice** (`describeHarnessResultProblem` in `shared/sessionDraft/format.ts`). The harness (`harness/handler.ts`, both the streaming and non-streaming sites) previously fed the terse validator string ("has an unsupported field") back to the model on a retry; the model then *deleted* the offending content instead of relocating it. Production (2026-11-01): draft #2 carried correct technique descriptions on items, the retry stripped them, and the saved session had a generic "Technique Warmup" of six identical unnamed steps. The harness-level sibling `describeHarnessResultProblem` adjudicates plan failures (whose limits live on the harness result, not the draft) and delegates draft failures; the raw validator string is still what lands in the analytics trace. The eval pipeline's `advice` uses the same function.
- The client sanitizes the coach's text locally (redacting swimmer names / emails / phones) and sends only that plus structural context (pool length, units, equipment options, recent-session shapes). Swimmer records, roster counts, session/drill names and notes, and the drill library are never sent. The draft types, allowlists, limits, and validators are single-sourced in `shared/sessionDraft/` and imported by both the PWA and the Edge Function.
- **Optional item fields treat JSON `null` as omitted.** Models routinely mark an absent `intensity` / `interval` / `equipment` with `null` rather than by omitting the key; treating that as present-but-invalid failed an otherwise usable draft with `502 invalid_provider_response` and discarded the coach's whole session. `isAbsent` in `shared/sessionDraft/validate.ts` normalizes `null` to `undefined` **only for genuinely optional fields** — a `null` in a required field (`drill.name`, `item.distance`, and notably `item.stroke`) is still rejected. A model may also emit `"stroke": null` for a kick set; that is a real contract-conformance gap the validator deliberately does not paper over.
- **Opt-in agent logging.** `agent/debug.ts` writes single-line, `[ai-harness] `-prefixed records to the `functions serve` terminal — `agent.provider.request` (full system prompt and user content), `agent.provider.response` (raw model output, status, elapsed, finish reason), `agent.provider.parsed`, `harness.rejected` (validator code + message), `harness.denied` (which lifecycle stage rejected the request), `harness.completed`. It is silent unless `AGENT_DEBUG=true` and must never be enabled in a deployed environment, because it prints the coach's sanitized prompt. Three independent signals confirm whether the LLM ran: the `ai_private.ai_request_log` row, Ollama's own per-request timings, and these records.
- A generated draft is **staged in component state and shown to the coach for fine-tuning beside the prompt** (`components/ai/DraftSessionPanel`). Nothing touches the database until **Save session**, which is the only caller of `applySessionDraft`; the coach can discard the proposal and nothing is left behind. `draftTotalDistance` / `draftDrillDistance` in `services/sessionDraft/apply.ts` are the single source of truth for the distance shown while editing and the distance persisted, so the two cannot diverge.
- On save, a draft is persisted via `addSessionWithDrills` (atomic, does **not** call `addDrill` which would write `libraryDrills`) and saved straight to the template list as a normal session; the coach is returned to `/sessions` in a single action. The AI step is purely a faster way to populate the drills — once saved, the session behaves identically to one built manually, and the coach can edit it in `SessionDetail` like any other template. There is no separate review/`unreviewed` gate.
- **Regenerating asks first.** While a proposal is on screen, `AiSessionDraft`'s Generate button routes through a `ConfirmDialog` ("Regenerate draft?" — generation replaces the proposal currently on screen). Production (2026-11-01): the coach generated twice on the same prompt and the first proposal was silently discarded, because the proposal lives in component state and is never persisted until Save; the button stays clickable once the stream completes. This mirrors — at component level — the persisted-single-unreviewed-draft gate.
- Pool length is **not** part of the session or the draft. It stays a global app setting and is frozen onto `SessionRun` at run start; the draft request context carries it only so the model generates intervals that suit the pool.
- V1 item fields are `distance`, `stroke`, `repeatCount`, `intensity` (v1–v4), `interval`, `equipment`. The model never emits stored-but-not-editable `segments`. Intensity maps easy→v1, medium/moderate→v2, strong→v3, hard→v4; omit if no effort cue. Equipment is restricted to `fins`, `paddles`, `pullbuoy`, `snorkel`.
- Evals: `supabase/evals/` holds a synthetic corpus (`cases.ts`), a pure scorer (`scorer.ts`, tested by `scorer_test.ts`), and a live opt-in runner (`run.ts`). The corpus covers the failure shapes seen in production: a warmup listing distinct techniques (must become one drill per technique — `distinctDrillNames`), conjoined equipment ("fins and paddles" — both must survive), a gradation ("descending 1 to 3", passable as extra-room text **or** stepped intensities via `anyOf`), and a Hebrew-input case (`hebrew-input`). The scorer composes requirements with `anyOf` and measures semantic identity (`distinctDrillNames`, `distinctIntensities`, `descriptionMentions`).
- **The coach test on Ollama uses a model close in behavior to production's gpt-4.1-mini** — `glm-4.7-flash:latest` is the closest installed general-instruct model; `gemma4` is smaller and follows contracts more loosely, so a clean gemma4 run does not imply a clean production run. Override per run: `PROVIDER_MODEL=glm-4.7-flash:latest deno run --allow-env --allow-net --allow-read supabase/evals/run.ts` (environment values beat `.env.functions.local`).
- **The schema cannot field every nuance — and must not.** Distance, intensity, interval, and equipment have first-class fields; what they cannot hold — technique focus, progression/gradation, breathing patterns, "long underwater push-off" — is the drill **name or description** (the extra room). Progression/gradation: a representative `v2`–`v4` intensity per step plus the gradation in the description ("descending 1 to 3"); never flattened to `v1`. The system prompt states this, and the evals assert the coach's nuance survives in one of the two encodings. When more data accumulates, fields may graduate out of the extra room into the model — until then, resist adding them.
