# Drill Model Context

## Purpose

The domain model for a **drill**: what it is, how its structure is expressed, and —
the part that is genuinely counter-intuitive — how a drill gets its identity.

For the session that composes drills, see `Session-Model-Context.md`. For the screens,
see `Drills-Screen-Context.md`.

---

## The one thing to understand first

**A drill's structure cannot tell you which drill it is.**

Four real drills:

| Drill | Distance | Stroke | Count |
|---|---|---|---|
| Fingertip Drag | 100m | freestyle | x4 |
| Scull | 100m | freestyle | x4 |
| Single Arm Pull | 100m | freestyle | x4 |
| 3-5-7 Breathing | 100m | freestyle | x4 |

Structurally these are **the same drill**. Nothing in `distance`, `stroke`, `repeatCount`,
`intensity`, `interval` or `equipment` distinguishes them. What distinguishes them is what
the swimmer is being asked to *do* — and that lives in the drill's **name**, with an
optional **description** for when the name is not enough.

Consequences worth holding onto:

- A step count, a distance total, or a repeat structure tells you nothing about technique.
- Two drills in one session may be structurally identical and still be different drills.
- A coach who says "do some fingertip drag" is naming a **drill**, not specifying a
  distance. Inferring the structure from the name is the agent's job.

---

## Identity

| Field | Required | Meaning |
|---|---|---|
| `name` | **yes** | The drill's identity. "Fingertip Drag", "Single Arm Pull", "3-5-7 Breathing". |
| `description` | no | What the technique actually is, when the name alone would not tell a coach what to do. |

A **dedicated typed field may replace `description` later.** For now name plus optional
description carry identity, and the library catalogue is the taxonomy of known techniques.

### Naming rules

- Prefer a name from the library catalogue when one fits — it keeps a coach's vocabulary
  consistent across sessions.
- Otherwise coin a descriptive name of the technique.
- **Never** name a drill "Set 1", "Main Set 2", or repeat the session name. A name that
  describes *where it sits* rather than *what it is* destroys identity, because the coach
  will want to reuse the drill elsewhere.

`Warmup` and `Main set` are legitimate names when the block genuinely is just a plain
swim — but prefer naming the content ("400 Easy", "Threshold 4x100") over naming the slot.

---

## The three schemas

There are three distinct drill shapes in the codebase. Confusing them is the most common
source of "why doesn't this line up".

### 1. The generated JSON Schema — `shared/sessionDraft/schema.ts`

What the **model is shown**. `buildDraftJsonSchema(config, context)` generates it from
`defaultSessionDraftConfig`, so its enums and bounds cannot drift from what the validator
enforces. Every field carries a `description` saying what it *means*, not merely what type
it is. Embedded verbatim in the system prompt.

This is documentation the model actually reads, so it is the place to put guidance.

### 2. The draft contract — `shared/sessionDraft/types.ts`

What the **agent produces** and the validator enforces:

```ts
SessionDraftDrillV1 {
  name: string
  description?: string
  repeatCount: number      // repeats of the whole block
  items: SessionDraftItemV1[]
}
```

### 3. The persisted entity — `client/src/db/schema.ts`

What is **stored** as a `Drill` row, via `mapDraftToSessionAndDrills`. It carries fields
the draft contract has no equivalent for, all hardcoded by that mapping:

| `Drill` field | Source |
|---|---|
| `stroke` | derived — the dominant stroke by distance × repeats |
| `distance` | derived — `sum(item.distance × item.repeatCount) × repeatCount` |
| `order` | array position |
| `timingMode` | hardcoded `'individual'` |
| `focus` | hardcoded `'none'` |
| `labels` | hardcoded `[]` |
| `description` | `draft.description ?? ''` |

So labels, focus and timing mode **cannot currently be set by the agent**. That is a known
gap, not an oversight in the mapping.

---

## The two levels of repeat

This is the single most common thing to get wrong, and it is why
`shared/sessionDraft/distance.ts` exists.

```
A drill's repeatCount  → repeats the whole block of steps
A step's  repeatCount  → repeats that one step
```

| Coach says | Encoded as |
|---|---|
| `400m warmup` | 1 drill, 1 step of 400m. Both counts 1. |
| `3 x 100m` | 1 drill, 1 step of 100m, **step** repeatCount `3`. Drill stays 1. |
| `2* 300, first at 2:00 per 100m, second with paddles at 1:50 per 100m` | 1 drill, **drill** repeatCount `2`, holding 2 steps of 300m, each step repeatCount `1`. |

Total distance is `item.distance × item.repeatCount × drill.repeatCount` — see
`draftDrillDistance`. Both encodings of "10 × 100m" are contract-valid and render
identically; the choice is about which level the coach's phrasing refers to.

Effort, recovery and equipment are **always per step, never per drill**. A block whose
steps differ is exactly what the step level exists for.

---

## Canonical notation — `shared/sessionDraft/format.ts`

```
<name> | <n> sets | <step>; <step>
<step> = <distance>m <stroke> x<reps> <intensity> @<interval> +<equipment>
```

Real output:

```
Warmup | 400m freestyle v1
Main set | 2 sets | 100m freestyle x3 v2 @1:30 +fins; 50m breaststroke x4
```

Two jobs:

1. **Matching vocabulary.** The library renders in this notation so a coach's phrasing can
   be compared against a concrete line rather than prose.
2. **Validation feedback.** `describeDraftProblem` turns a validator failure into a
   sentence an agent can act on — naming the offending step and the fields it may carry,
   rather than "has an unsupported field".

Format tests pin the exact output so the notation cannot drift.

---

## Bounds

All from `shared/sessionDraft/config.ts`, never inlined at the point of use.

| Limit | Value |
|---|---|
| `maxDrills` | 30 |
| `maxItemsPerDrill` | 10 |
| `maxDistance` | 10,000 |
| `maxRepeatCount` | 100 |
| `maxNameLength` | 100 |
| `maxDescriptionLength` | 400 |
| `maxPlanEntries` | 12 |

---

## The library

`client/src/data/drills.json` ships **57 built-in drills** — name, stroke, distance, focus,
labels, description. It is static application content already in the client bundle, not
user data.

That distinction matters: built-in drills carry no privacy cost to include in a request,
whereas a coach's own library drills are author-written free text and are a different
proposition. Keeping the two separate is deliberate.

The library is currently **not** sent to the agent. Wiring it in is pending a decision on
how matching should work — see "Open decisions" below.

---

## Open decisions

- **How the library reaches the agent.** The built-in 57 could be rendered into the prompt
  as a compact index (~1k tokens, no privacy cost), or fetched on demand via a tool call
  (costs an extra model round-trip). The index is the cheaper option; the tool is the
  better answer once coach-authored drills are in play.
- **Whether a match is recorded.** `Drill.libraryDrillId` exists and is never populated by
  the draft path. Recording a match is what stops a coach re-creating the same drill, but
  presenting ids to the model risks it forcing the session into the nearest catalogue entry
  rather than recognising when nothing fits.
- **`description` as identity vs a typed field.** Currently free text. A typed technique
  field would make matching machine-readable but costs a contract change across schema,
  validator, prompt, mapping and UI.