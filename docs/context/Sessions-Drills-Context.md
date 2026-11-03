# Sessions & Drills — Session-Building Flow Context

## Purpose

Focused context for the **session-building** experience: how a coach turns a session
from their head/notebook into a SwimSheet template. Scope: `SessionDetail.tsx`,
`SessionsList.tsx`, `DrillEditorModal.tsx`, `DrillBank.tsx`, `db/schema.ts`
(Drill/DrillItem), `db/dao.ts` (seed data + `DEFAULT_EQUIPMENT`),
`services/runService.ts` (`createFromTemplate` snapshot).

**Status note**: maintained current-state. The reference session, the mapping table,
the open friction list (F-1…F-17), the settled design decisions, and the pointers to
the deep design docs are canonical; resolved debates are one-line resolutions. Deep
design lives in `Drill-Identity-Context.md` (drill identity + bank taxonomy) and
`Drill-Set-Grammar-Context.md` (complex-set grammar + API). The AI draft flow is
documented in `UI-Context.md` (AiSessionDraft) and `Drill-Model-Context.md`.

## The Reference Session

Real session supplied by a coach. This is the "can I build this easily?" bar.

### Endurance Session (sample)

**Warm-up** (~600m)
1. `2×200m` — each 200m is `50m freestyle (focus on hard kicking) / 50m fingertip drag /
   50m fist hands / 50m breathing every 5` (on the 2nd iteration breathe every 7 strokes).
   All segments are full freestyle swims with a drill/instruction emphasis — **no equipment**
   (kick = "kick hard", not a kickboard drill). Breathing-style details live in the
   segment/drill description.
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
| 1 | 2×200m: 50 free (hard kick) / 50 fingertip drag / 50 fist / 50 breathing-every-5 (2nd round breathe 7s) | warmup | `repeatCount: 2`, 4 items of 50m; needs per-segment names/notes to carry "kick hard", "breathing every 5"; no accessory on any item; round-2 variation lost | ⚠️ Partial |
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

A coach thinks of a session as **three sections** (warm-up → main set → cool-down),
each made of **sets/drills**. Sections are the unit a coach actually reuses:
"my standard warm-up" is reused across every session with tiny tweaks; main sets are
usually new or adapted; cool-downs are near-identical daily. The tool's job is to
make **reuse** the default — rebuilding a section from atomic drills every session is
the friction reported ("I don't have an option to save the warm-up").

### Three-layer model (reuse granularity)

```
Bank (blocks)            Sections (reusable groups)    Sessions (structured whole)
"100m Freestyle"         "my standard warm-up"           "Tuesday Endurance"
one entry per            ordered blocks + phase          ordered sections + metadata
instruction, with a      (the F-8 entity)                (the template)
default distance

✅ exists today           ❌ DOES NOT EXIST              ✅ exists today
```

Bank blocks are atomic and complete (grab-and-go for quick timing); sections are the
missing entity (named, phased group of blocks); sessions are the structured whole.

### Full lifecycle (Create → Run → Mine)

1. **PLAN** — open a new session, pull in a saved warm-up section, then pull a saved
   main-set section, mine one from a past session, or build it fresh from the bank. Add
   a cooldown section. Name it, done.
2. **RUN** — snapshot to a live run. Timing is a runtime decision: warm-up and
   cool-down can be left untimed; only chosen swimmers get timed (F-9 resolved).
3. **MINE** — after the run, "save this section to the library" should be one action.
   Next session pulls it, not its raw parts (still missing — F-8/F-17).
4. **TRACK** (future) — per-swimmer lap data feeds progress charts; the run-snapshot +
   per-swimmer timing model must not block this.

### Personas

- **P1 "The Deck Timer"** — deck-first, ≤2 taps to a clock, times everything,
  reuses a handful of basic swims. Non-negotiable: speed. Fine leaving advanced tools
  buried.
- **P2 "The Set Architect"** — editor-first at home, precise complex sets, reusable
  sections. Non-negotiable: expressibility (F-1…F-7) + sections (F-8) + runtime
  timing (F-9).
- **P3 "The Engineer"** — API conscience: clean, minimal, honest; no UI-driven bloat,
  no dual sources of truth, no business logic in DAO/UI; one canonical rep stream.

## Design Decision: "100 Free" IS a Drill (settled)

There is no separate "quick swim" and "planned set". A quick swim is the **degenerate
case** of the full drill grammar: one item, minimal attributes, no phase, no
equipment. **One substrate, two skins.** Quick Time attaches to a session template
and appends drills as real `RunDrill` rows — no parallel model.

| | Quick Time (P1's door) | Planned Session (P2's door) |
|---|---|---|
| Entry | deck-first (`/` LiveDeck), 1 tap to a clock | editor-first (`/sessions`, sections, grammar, library) |
| Unit | one swim ("100 Free"); the quick run accumulates drills | session = sections of drills |
| Deck rendering | clock + labeled rep rows, add/remove anytime | plan structure preserved per rep rows |
| Add swimmer | one-touch chip (synthetic id) | roster-linked, promotable |

Guardrails: the rich editor and section library stay first-class routes even when P1
never sees them; when a planned run is active the deck renders its structure so P2's
plan isn't erased at execution time; untimed drills can still render as instruction
cards.

## Friction Points — the OPEN gap list

Ranked by how much they slow a coach building the reference session. Each re-verified
against the current code. **Drill identity / bank taxonomy** → `Drill-Identity-Context.md`.
**Complex-set grammar / API** → `Drill-Set-Grammar-Context.md`.

### F-1. Progressive send-off intervals unsupported (blocks the whole main set)
`DrillItem.interval` is a single free-text string (`db/schema.ts`), edited as one
small field (`DrillEditorModal.tsx`). `createFromTemplate` flattens individual-mode
reps giving **every rep the same interval** (`runService.ts`). "4×200 @ 4:00→3:45"
cannot be one drill — a coach must create four drills. Fix: resolve per-rep send-offs
at snapshot time (progression/explicit steps) and display the correct send-off per rep.
**Open.**

### F-2. Warm-up segments lose their meaning (partially mitigated by F-16)
`DrillItem` carries `distance/stroke/repeatCount/intensity/interval/equipment/
description/segments` — no short `name`/`note` per step; `focus`/`labels` live on the
drill, not per segment. `DrillSegment` has a `name` (`db/schema.ts`) but is for
broken sets only and isn't editable in `DrillEditorModal`. "50m freestyle (kick
hard)", "50m fingertip drag", etc. still collapse into "50m freestyle". The v1
`description` field (F-16) is the partial bridge: AI drafts carry technique text per
step; the hand editor has a technique input too. Fix: per-step short labels rendering
on the session card and deck; a segment picker linking to an existing bank drill.
**Open (partial).**

### F-3. Kickboard picker/data mismatch (residual)
`EQUIPMENT_OPTIONS` (`constants/drill.ts`) = fins/paddles/pullbuoy/snorkel — no
`kickboard`. The DAO `DEFAULT_EQUIPMENT` does include `kickboard` (and `zoomers`).
The former seeded-bank kickboard drills are gone (bank seeds from `data/drills.json`,
no kickboard), so only the **picker vs equipment-vocabulary mismatch** remains: a
coach cannot select a kickboard in the editor. Fix: align the picker with the
equipment vocabulary. This is *not* needed for the warm-up "kick" segment (a
kick-focused freestyle carries no accessory, F-2). Do **not** introduce a "kick"
stroke type. **Open (residual).**

### F-4. Recovery interleaves force set-splitting
"50m easy @ 1:00 between each 200m" is a paired structure: 4×(200 + 50). The model
has no concept of a recovery swim interleaved into a set, so the coach creates a
separate "50m easy" drill and the card/deck show `4×200` and `4×50` as independent
drills, losing the pairing. Fix: optional `recovery` sub-component on a drill item;
flattened in `createFromTemplate` as alternating reps tagged easy/recovery.
**Open.**

### F-5. Per-round variation is unrepresentable
`repeatCount` is just a count. "On the 2nd iteration breathe every 7 strokes" and
"descend" (each rep faster) have no field; `descend` survives only in the drill
name. Fix: per-rep/per-round modifiers (see `Drill-Set-Grammar-Context.md`: ladder
or round notes). **Open.**

### F-6. Session assembly is one-modal-at-a-time with no duplicate
Building the reference session needs ~9 open-modal → fill-form → save round-trips;
there is **no duplicate/copy action** on a session drill row (`SessionDetail.tsx`), so
"4×200 @ each send-off" and "the 4×100s @ 1:55 vs 1:45" each demand a full re-entry.
The similar-drill warning additionally fires for *intentionally* distinct sets (#7 vs
#6). Fix: duplicate button per drill row; smarter similar-drill warning (warn on same
name *and* everything; allow interval-only differences). **Open.**

### F-7. Everything above compounds at the snapshot
`createFromTemplate` (individual mode) flattens each template drill into N `RunDrill`
rows with a `(r/n)` prefix. That is the right model for pacing — but each rep
inherits the same `interval`/`instructions` (F-1/F-2), so the deck can't show "rep 2
— send-off 3:55". Fixing F-1/F-4 at snapshot time fixes the deck automatically.
**Open.**

### F-8. No reusable section/block entity — the "save the warm-up" gap
Only two reuse units exist: atomic drills (drill bank) and whole sessions
(templates). The unit a coach reuses — the section — doesn't exist: a coach cannot
save "my standard warm-up" and pull it into tomorrow's session, and there's no
"mine a section from a past session or run" path. Sessions are flat ordered drill
lists with no grouping that could *be* a saved block. Fix: introduce a section/block
entity — a named, phased group of drills that (a) composes into sessions, (b) is
saved into a section library, (c) can be created by "save section from this
session/run". Bigger than a drill, smaller than a session. **Open.**

### Resolved items (kept for history; not open)

- **F-9 — timing baked into the drill model.** RESOLVED by removal: the
  `timingMode: 'individual' | 'continuous'` field (and continuous mode) was removed
  (Oct 2026). Drills always unroll to one `RunDrill` per rep in `createFromTemplate`;
  whether a rep gets a clock is a deck-side runtime decision. The three historical
  questions ("is this drill timed at all / how / who") are answered by the runtime
  timing model and the never-auto-start deck rework — any remaining piece ("warm-up
  defaults to untimed instruction cards") hangs off the phase labels, not a saved
  timing binary. The core blocker (a saved 'continuous' collapse) cannot regress.
- **F-10 — phase labels vs runtime detection.** SUPERSEDED. The phase banner and
  `ProgressGroupCard` were removed in the Overview/Timing split (and Overview mode
  itself was later replaced by the LiveDeck/ActiveRunView live UI). The canonical
  label vocabulary today is `PHASE_LABELS = ['warmup', 'pre-set', 'main set',
  'cool down', 'taper']` (`constants/drill.ts`). Future phase-default-timing work
  should read these labels as names, not parse renamed runtime strings.
- **F-15 — Progress Mode still has a clock.** SUPERSEDED with F-10: Progress Mode
  is gone. Timing is opt-in per drill in the live deck; show the clock only where the
  coach opted in.

### F-11…F-17 — findings from the persona review

- **F-11 — The drill bank isn't fully scannable.** Drill cards render primarily
  `reps×dist stroke`; interval/equipment/intensity detail requires opening the drill.
  Verify current `DrillBank.tsx` rendering before considering this fixed.
- **F-12 — Reps can be wedged into "steps", silently lying.** A progression or
  recovery interleave *can* be squeezed into one drill as N components, but semantics
  are lost downstream. Worse than "can't build it": it looks built and reads wrong.
- **F-13 — No drag-and-drop, no duplicate drill.** Code has only up/down reordering
  and no duplicate action (`SessionDetail.tsx`) — the #1 repeated-work killer (dup. F-6).
- **F-14 — Interval is unvalidated free text.** Bare input in the editor
  (`DrillEditorModal.tsx`); a typo like `3:5` flows into the run snapshot. The AI-draft
  path has a stricter interval regex (see `Drill-Model-Context.md`), but the human
  editor does not share it.
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
- Segments render with their short labels on the session card and in the live deck;
  free-form breathing detail is carried in the description.
- Kickboard is selectable wherever the equipment vocabulary includes it — one list, not two.
- Progressive intervals resolve to per-rep send-offs in the live deck.
- Recovery swims alternate with their set reps in the live deck and are labeled easy.
- **Sections are reusable**: save the warm-up once, pull it into any new session; mine
  a section from a past session/run.
- Timing is a runtime decision: the coach can time per drill/lane/swimmer; per-swimmer
  timed data is what future progress tracking consumes.
- Once the model supports it, seed this exact session as a demo template.

## Related

- Data model: `docs/context/DB-Context.md`
- UI/system context: `docs/context/UI-Context.md`
- Drill identity / bank taxonomy: `docs/context/Drill-Identity-Context.md`
- Complex-set grammar / API: `docs/context/Drill-Set-Grammar-Context.md`
- Quick-start flow: `docs/context/Quick-Start-Context.md`