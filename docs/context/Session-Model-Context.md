# Session Model Context

## Purpose

The domain model for a **session**: how drills compose into a plan, what the agent
produces, and where the boundaries are today.

For the drills it composes, see `Drill-Model-Context.md`. For the screens, see
`Sessions-Screen-Context.md`.

---

## The shape

```
Session
  └── drills[]           in the order they are swum
        └── items[]      the steps inside one drill
```

A session template is a **plan**: an ordered list of drills, reusable across runs. It is
not a record of what happened — that is `SessionRun`, which freezes its own snapshot at
start.

| Entity | Purpose |
|---|---|
| `Session` | The template. Name, notes, drills. Reusable. |
| `Drill` | A named block within the template. |
| `SessionRun` | One execution. Freezes `SessionRun.poolLength` and a session snapshot. |
| `RunDrill` | A drill within a run. |

**Pool length is not a property of a session.** It is a global app setting, frozen onto
`SessionRun` at run start — because the same template gets run in a 25m pool and a 50m
pool, and history must show what actually happened.

---

## The agent's plan

When the agent drafts a session it emits a `HarnessResult`:

```ts
{ outcome: 'draft', plan?: string[], draft: SessionDraftV1 }
```

- **`plan`** — one short line per drill the agent decided on, in order, saying what each
  is and why the repeat count sits where it does. It is how the agent reports *reading the
  request* before building anything, so a plan that contradicts the draft it produced is
  immediately visible.
- **`plan` is optional by design.** A model that omits it still yields a usable draft.
  Losing the plan must never cost the coach a session.

The plan is **not persisted**. It is agent metadata about interpreting a request, not
session content, so it lives on the outcome rather than on `SessionDraftV1`.

### Decomposition

The agent splits the coach's words into drills first, then fills each one in. Worked
cases, pinned by `agent/prompt_test.ts`:

| Coach says | Becomes |
|---|---|
| `400m warmup` | one drill, one step of 400m |
| `3 x 100m` | one drill, one step of 100m with the **step** repeatCount at 3 |
| `2* 300, first at 2:00 per 100m, second with paddles at 1:50 per 100m` | one drill at **drill** repeatCount 2, holding two 300m steps |

---

## Rest and recovery

**There is no rest drill, and that is deliberate for now.**

Recovery currently exists only as `interval` on a step — rest taken *after that step's
repetition*. A standalone resting stage — "2 min walk-out", "5 min between sets", "and
then a good 5 minutes easy" — **cannot be represented at all**. A rest is not a swim, so it
has no honest distance, stroke or count, and forcing it into one produces nonsense rows.

The plan is to add a structural representation for rest and intervals first, with timing
options, and only then let the agent use it. Until that exists, a rest stage will either
be dropped or be absorbed into an adjacent step's interval, and neither is good.

This is a known gap. It is listed again in `App-Tasks-Context.md`.

---

## What the agent cannot set

`mapDraftToSessionAndDrills` maps the draft onto stored rows and hardcodes anything the
draft contract has no equivalent for:

| `Drill` field | How it gets its value |
|---|---|
| `stroke` | derived — dominant stroke by distance × repeats |
| `distance` | derived |
| `order` | array position |
| `description` | `draft.description ?? ''` |
| `timingMode` | hardcoded `'individual'` |
| `focus` | hardcoded `'none'` |
| `labels` | hardcoded `[]` |

So an AI-drafted session arrives with **no labels, no focus and no timing mode**, whatever
the coach would have chosen. The coach fixes these afterwards in `DrillEditorModal`.

---

## The proposal panel

On wide screens the compose/review card sits beside a proposal panel
(`client/src/components/ai/DraftSessionPanel`). **The draft is staged in memory and only
persisted on Save** — nothing reaches Dexie until the coach confirms, and Discard leaves
nothing behind. That keeps the single-unreviewed-draft-per-device guarantee intact and
makes the panel authoritative: what the coach sees is exactly what gets persisted.

Controls cover the fields the draft contract carries — session name, drill name, set
repeats, and per-step reps / distance / stroke / intensity / interval / equipment, with
drills addable, removable and reorderable. They deliberately **exclude** `timingMode`,
`focus` and `labels`, because the contract has no equivalent; those are reachable in
`DrillEditorModal` after saving.

The staged draft is validated with the shared validator on every render, so an unparseable
interval shows the validator's own message and disables Save rather than failing at save
time.

---

## Open decisions

- **Rest as a first-class stage.** Needs the structural work described above before the
  agent can express it.
- **Library matching.** Drills from the 57-drill built-in catalogue are not yet offered to
  the agent. See `Drill-Model-Context.md`.
- **Refine-in-conversation.** The coach can currently edit the proposal by hand or ask for
  a fresh generation. Carrying the staged draft back into the harness as the starting
  point for a follow-up instruction is a contract change: `validateSeed` in
  `shared/sessionDraft/validate.ts` hard-rejects any seed that is not an empty session, so
  "here is what you built, change X" cannot ride on the existing request shape today.