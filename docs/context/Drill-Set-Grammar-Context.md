# Drill Set Grammar — Context

The target grammar for complex sets (progressions, pyramids, recovery interleaves,
per-round variation, per-lane pacing). **Design, not yet code**: the current
`DrillItem` schema has no `base`/`ladder`/`recovery`/`rounds` fields. Companion to
`Sessions-Drills-Context.md` (flow + friction list) and `Drill-Model-Context.md`
(schema + AI contract). Source: `Sessions-Drills-Context.md` "Worked Example: The
Pyramid Drill" and "Drill API / Data Model for the Set Grammar".

## Worked Example: The Pyramid Drill

A coach wants `100m strong / 200m medium / 300m easy / 300m strong / 200m medium /
100m easy` — the stress test for the complex-set grammar and for "can I time just
one part?"

### One drill = one coach sentence

The pyramid is a single drill whose `items` are the six per-rep steps, each
carrying a **length** and an **effort label** — exactly the F-1/F-5 per-rep
grammar, not a new concept:

- **Explicit steps (stored/snapshot truth)**: six items, each `{distance, effort}`.
  Handles any irregular progression exactly, including this mirror-image pyramid.
- **Pattern shorthand (authoring convenience only)**: P2 types `pyramid 100/200/300/200/100`
  and it expands deterministically into explicit steps. What's stored and snapshotted
  is always the explicit sequence, so deck, timing, and history behave identically.

### The v-scale

Per-rep effort on the **v-scale**: `v1 = easy → v4 = hard`, with `sprint`/`all-out`
reserved for short swims (typically 50m–100m). Decisions: add a fifth marker
`v5 = sprint/all-out` with the short-distance rule (feeds the effort dimension for
bank filtering); the scale needs its legend everywhere it renders (today bare
`v1`–`v4` values). Numbered effort scales are standard in the sport (zones 1–5/1–7,
RPE 1–10); "max efforts are short swims" is well-supported.

### Timing just the "300m strong"

Per-rep flattening is universal, so the pyramid arrives at the deck as six
independently-timed rows. What makes "time only rep 4" work is per-rep timing
control: untimed reps produce zero lap rows, so future progress tracking stays clean.

Two wrinkles: (1) the two 300s need distinguishable labels ("300m easy" vs
"300m strong") — the F-2/F-16 guardrail that segment labels survive the snapshot;
(2) structure is always per-rep, timing is per-rep-at-runtime. A pyramid should
never collapse; the only question is *which reps get a clock*.

### Two lanes, one drill — pacing is per-lane, anchored to a base

Same pyramid, two lanes: lane 1 (stronger) on `1:45`, lane 2 on `2:00`. Both do
3×100m; each lane's reps descend from its own base. Coaches group by ability —
**structure is shared, pacing is per-lane and anchored to a base**.

- **Base pace per lane** — the lane's anchor, set once ("lane 1 on 1:45s"). Realistic
  and standard: threshold/CSS/T-pace reference pace; squads split lanes by ability.
- **The drill carries a relative ladder, not absolute times** — `descend 0 / −5 / −10s`,
  or `+15s rest`, or an effort mapping. Effective send-offs = `base + ladder[rep]`.
- The coach never re-enters the ladder per lane — set the base once; the drill's
  relative structure applies to every lane. Per-lane absolute overrides remain
  possible when a set genuinely differs.
- **Base can anchor both** send-off (when to leave) and target pace (how fast to swim —
  informational); send-off is what matters at the wall.
- The deck shows each rep row with every lane's effective send-off. Set in run setup,
  adjustable mid-run.

This reinforces the architecture: **send-off/pacing is execution context, not drill
identity**.

## Drill API / Data Model for the Set Grammar (design — not yet code)

Goal: the drill model expresses every variation with the **minimum set of fields**.
The snapshot stores **relative** grammar (`base` + `ladder` + run-level lane→base
map); absolutes are derived by an exported `effectiveSendOff()` at render time —
never baked into the snapshot (a second absolute copy would drift, and mid-run
lane-base edits would leave it stale).

### The core: base time + relative ladder

Every paced unit has a **base time** (preset/reference, seconds) and optionally a
**relative ladder** (per-rep offsets from base). Effective rep send-off =
`(lane base override ?? item.base) + ladder[rep]`.

- **Simple drill**: base only → all reps on base ("8×100 @ 2:00" = base 120).
- **Descend**: base + ladder `[0, −5, −10, …]`. "Descend by 5s" is authoring
  shorthand; stored truth is always base + offsets.
- **Custom**: any ladder ("2:00, 1:50, 2:00" → base 2:00, ladder [0, −10, 0]).
- **Sign convention**: negative = tighter/faster (descend), positive = build/rest.
- **Absolute ladders need no separate form**: base = rep-1 send-off, offsets relative.

### DrillItem (proposed fields)

| Field | Kind | Maps to |
|---|---|---|
| id, distance, stroke, repeatCount | existing | |
| intensity?: 'v1'…'v5' | existing | per-rep effort; v5 = sprint/all-out |
| equipment?: string[] | existing | |
| description?: string | existing | per-step technique description (F-16) |
| segments?: DrillSegment[] | existing | broken sets |
| name?: string | **new** | short segment label (F-2) |
| base?: number | **new** | preset/base time (seconds) — pacing anchor |
| ladder?: number[] | **new** | per-rep offsets from base; absent = all reps on base |
| strokeLadder?: number[] | **new** | per-rep stroke-count offsets for test drills |
| rest?: number | **new** | fixed rest (seconds) after each rep — alternative to base+ladder |
| recovery?: { distance, stroke?, base?, rest?, note? } | **new** | F-4 between-rep recovery swim |

`interval?: string` (free text) is **replaced** by `base` + `ladder` — no string DSL,
no parsing; validation is structural (numbers, ladder length = rep count, sign range).

### How each variation maps

| Variation | Representation |
|---|---|
| Simple drill (8×100 @ 2:00) | repeatCount 8, base 120 |
| Descend (4×200 @ 4:00→3:45) | repeatCount 4, base 240, ladder [0, −5, −10, −15] |
| Pyramid (3×100, two lanes) | repeatCount 3, base 105 (lane 2 overrides to 120), ladder [0, −5, −10] |
| Big pyramid (100/200/300/300/200/100) | six items, each distance + intensity + base + offsets |
| Recovery interleave (4×(200 + 50 easy)) | item 200 base 240 + recovery { distance: 50 }; flatten alternates |
| Named warm-up segments | items with name (F-2), description carries breathing detail |
| Per-round change ("2nd round breathe every 7") | rounds [ {}, { note: 'breathe every 7' }, … ] |
| Per-lane scaling | run lane base override, offsets untouched |
| Effort pyramid | per-item intensity (v1–v5) across the steps |
| Stroke-count test (10×50, +1 stroke/rep) | repeatCount 10, timed reps + strokeLadder [0..+9] |
| Round-progression set (3× pyramid: long strokes / fast pace / paddles+buoy) | items [100,200,400], repeatCount 3, rounds [{name:'long strokes'},{name:'fast pace',intensity:'v4'},{name:'gear',equipment:['paddles','pullbuoy']}] |
| Fixed-rest set (100m v4, 20s rest) | item {distance:100, intensity:'v4', rest:20}; deck runs a rest countdown |
| Rest between drills | drill-level `rest?: number` |

### Round-level modifiers — per-iteration variation

A coach runs `3 × (100m / 200m / 400m)` where each iteration differs (round 1 "long
strokes", round 2 "fast pace", round 3 "paddles + pull buoy"). The pyramid steps are
`items`; the "×3" is `repeatCount`; the per-iteration difference is the missing piece.

**Fix (minimal):** optional `rounds` on the drill — one modifier per iteration: `name?`,
`note?` (per-round note), `intensity?`, `equipment?`, and a single scalar `baseOffset?`
(round-level pacing offset). Rules:

- `rounds.length = repeatCount` (validation). Absent = all iterations identical.
- Flattening: for each round, for each item → rep row carrying the round's
  name/intensity/equipment.
- **Rounds stay bounded — no distance, no per-round ladder**: per-round distance means
  writing explicit items; `rounds` is a modifier, not a second `items` grammar.
- The round note must survive flattening onto the deck rep rows.
- **Alternative with no new structure**: write the set as 9 flat items — fully
  expressible, but the session card and deck lose the "3× pyramid" grouping.

### The stroke-count test drill ("find your sweet spot")

`10×50m`, each rep one stroke more than the last, timing every rep and counting
strokes. Purpose: find the swimmer's **sweet spot** — the stroke count/rate where
adding a stroke stops buying speed (speed = stroke rate × distance per stroke).
Standard practice (stroke-rate ladders, DPS tests, SWOLF).

- **Structure**: 10×50m freestyle, reps timed — per-rep rows already exist.
- **Prescription**: `strokeLadder` = relative offsets (`[0, +1, …, +9]`), per-rep.
- **Base stroke count is per-swimmer** at run time: effective target = `swimmer
  strokeBase + ladder[rep]` — same run-level execution context as the lane→base map.
- **Recording**: per-rep time + per-rep stroke count — `Lap.stroke_count` already exists.
- **"Test" is not a new type.** Same grammar with a stroke ladder + timed reps; a
  `focus: 'test'` label marks it for grouping/display (`diagnostic` rejected — one word
  wins). The deck prompts a stroke-count entry per timed rep **in planned/test runs only
  — never in quick picks** (P1 red line).
- **Sweet-spot analysis is future** (TRACK): compare per-rep `time` and `stroke_count`
  (SWOLF = time + strokes; lowest = most efficient). The API carries the prescription
  and records the measurements — no computation in the API (anti-bloat).

### Rest vs send-off — recovery specification

Coaches specify recovery two ways, both standard:

- **Send-off (interval)** — wall-to-wall cadence: "8×100 @ 2:00". Rest is whatever's
  left after the swim. This is the current `base` + `ladder` pacing.
- **Fixed rest** — a recovery timer: "100m v4, then 20s rest". Rest is explicit; the
  send-off is implicit (varies with swim time).

Both supported as **alternatives**:

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
countdown is the send-off. Same timer mechanism, different "when does the next one
start" source.

### Deliberately NOT added (anti-bloat)

- No string DSL for intervals — structured numbers only.
- No per-swimmer targets — pacing is per-lane; swimmer-specific goals are future.
- No per-rep equipment/stroke overrides — equipment/stroke may vary at the **round
  axis** and the **recovery axis**; per-*rep* overrides are illegal — a genuinely
  mixed set uses multiple items or rounds.
- Quick mode stays a UI mode, not an API flag — no `isQuick` field; appends are
  `addRunDrill`; the deck advances reps manually; a quick run never mutates the
  shared default session.
- **Snapshot stays RELATIVE**: `createFromTemplate` stores `base` + `ladder` + the
  run-level lane→base map — it does NOT resolve to absolute per-rep send-offs.
  Absolutes are derived by an exported `effectiveSendOff()` service function the deck
  and any future agent call; mining a section from a past run is a **copy** of the
  relative grammar, not a rebuild.

### Phasing

- **Phase 1 (API only)**: `DrillItem` fields; structural validation moves out of
  `dao.ts` into `services/drillService.ts` (DAO stays pure CRUD — every write path
  validates at one service boundary); `runService` stores the relative snapshot and
  `drillService` exports `effectiveSendOff()`. The sections field envelope (name,
  phase, ordered drill refs, inter-drill `rest`) is sketched so Phase 1 doesn't
  close it off; the sections entity itself is separate work.
- **Phase 2 (later)**: drill-builder UI that starts simple (base time) and
  progressively reveals descend / custom ladder / recovery / named segments / effort
  — never more complex than the coach's current step needs.

## Related

- Flow + friction list: `docs/context/Sessions-Drills-Context.md`
- Drill identity / bank taxonomy: `docs/context/Drill-Identity-Context.md`
- Schema + AI contract: `docs/context/Drill-Model-Context.md`