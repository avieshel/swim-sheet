# Drill Identity & Bank Taxonomy — Context

Settled design decisions for how a drill is identified, how the drill bank is
navigated, and the dimensions coaches filter on. Companion to
`Sessions-Drills-Context.md` (flow + friction list) and `Drill-Model-Context.md`
(schema + AI contract). Source: `Sessions-Drills-Context.md` "Drill Identity" and
"Drill Dimensions" sections.

## Drill Identity: Named Instruction + Parameters (settled)

A drill's identity is its **named instruction**, never the stroke or the length.
"100 Free" and "200 Free" collapse (same instruction, different dose); "100 Free"
and "100 Fingertip Drag" stay distinct even though both are freestyle. Stroke,
distance, and equipment are **properties/parameters**, not identity.

**Why the T-shirt/variant analogy was rejected**: swims have continuous length (no
finite size rack), a 200 free is a different assignment not a longer 100 free, and
stored variants rebuild the explosion they claim to kill. Length is a *dose*.

**Why it's almost free today**: `items[].distance` already carries the real per-rep
length; top-level `distance` is a derived display total. Collapsing length is
structural, not a migration.

**Bank blocks carry a default distance** (product-owner decision): one entry per
named instruction, distance is a mutable default — not a stored variant, not
identity. The picker defaults to block default, then last-used per instruction, so
"tap Freestyle, time 100m" stays one tap. Equipment is a sentence parameter, never
a product identity.

**What it fixes**: bank collapses length-duplicates (F-11); similar-drill detection
becomes exact on the instruction axis; segments link to a product and supply their
own length (F-2); P1's picker stays one tap.

## Drill Dimensions — bank taxonomy

Coaches find drills by navigating, not scrolling. Every drill carries these facets:

| Dimension | Values | Source |
|---|---|---|
| Instruction | "Freestyle", "Fingertip Drag", "Pyramid" | identity — the name |
| Stroke | free / back / breast / fly / IM | `stroke` |
| Type / pattern | simple / progression / descend / pyramid / interleave / test / broken | **derived** from the grammar |
| Distance | default length | block default |
| Equipment | none / fins / paddles / pullbuoy / snorkel (+ kickboard/zoomers) | item `equipment` |
| Effort | v1–v5 | item `intensity` |
| Focus / purpose | technique / fitness / endurance / sprint / test / recovery | `focus` (enum expands) |
| Labels (facets) | catch, rotation, breathing, … (18 facets) | `labels` |
| Phase | warmup / pre-set / main set / cool down / taper (`PHASE_LABELS`) | `labels` |

- **Type is derived, not stored** — from the grammar present (`ladder` → progression,
  `strokeLadder` → test, `recovery` → interleave, `rounds` → round-progression,
  `segments` → broken). One less field, no drift.
- **No parallel taxonomy** — dimensions are views over existing fields plus derived
  type; nothing stored twice.
- **Similar drills** = shared dimension set (same instruction = exact identity; same
  stroke + type + equipment = "similar") — the relationship behind the similar-drill
  warning and bank suggestions.
- **Bank navigation** = filter chips over dimensions + search by instruction.
- The quick picker (A-027) and the P2 bank are the **same filtered list** with
  different default dimensions.

## Three-Persona Review — settled decisions

After the two-persona debate (P1 "Deck Timer" ↔ P2 "Set Architect") converged, P3
"The Engineer" joined and all three cross-examined. The product owner ratified 8
decisions (reflected in the design docs and open tasks):

| Decision | Verdict |
|---|---|
| Auto-start row | First pick creates row #1, subsequent picks append (never replace) |
| Laps on never-promoted temp chips | Retained, excluded from progress tracking until promoted |
| Description on the deck | Planned rows show it (timed + untimed); quick rows are label-only |
| Effort top end | Add `v5` = sprint/all-out (short-distance rule, ~50–100m) |
| Recovery interleave count | Explicit authoring control (between/after/both); engine never guesses |
| Round modifiers | Pacing offset only (`baseOffset`); distance stays in explicit items |
| Sections | Copy-on-pull (library canonical); section phase wins for timing defaults |
| Length memory | Block default wins, then last-used per instruction (not global) |

## Related

- Flow + friction list: `docs/context/Sessions-Drills-Context.md`
- Schema + AI contract: `docs/context/Drill-Model-Context.md`
- Bank screen: `docs/context/UI-Context.md` (DrillBank section)