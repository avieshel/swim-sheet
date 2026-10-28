// Builds the provider request content. The prompt deliberately receives only
// the sanitized coach text and structural context — no swimmer names, roster
// counts, session notes, or drill-library contents.

import type {
  HarnessResult,
  SessionDraftContext,
  SessionDraftRequest,
  SessionDraftV1,
} from './contract.ts'
import type { IntensityV1 } from '../shared/sessionDraft/types.ts'
import { defaultSessionDraftConfig } from '../shared/sessionDraft/config.ts'
import { buildDraftJsonSchema } from '../shared/sessionDraft/schema.ts'

// A complete, valid response built from the shared config. The system prompt
// used to elide the inner draft as `{ ... }`, which left weaker models to guess
// that `session` was an object rather than a bare string — a guess the strict
// validator then rejected. Showing a real example removes the guesswork, and
// deriving it from the config keeps it from drifting out of contract.
//
// The example deliberately carries more than one drill, and one drill with more
// than one item. A single drill holding a single item is ambiguous: a model can
// read `items` as "the things in this drill" and then nest whole drills inside
// it, which arrives at the validator as unsupported fields on an item.
//
// The example also carries the plan, one line per drill, held to the shared
// word budget: a model that never sees a plan line writes sentence-length ones,
// which the instruction cannot fix because models cannot count characters.
export type DraftHarnessResult = Extract<HarnessResult, { outcome: 'draft' }>

export function buildExampleResult(context: SessionDraftContext): DraftHarnessResult {
  const enabledEquipment = context.equipmentOptions[0]
  const [firstStroke, secondStroke] = defaultSessionDraftConfig.strokeValues
  const equipped = <T extends object>(base: T): T =>
    (enabledEquipment ? { ...base, equipment: [enabledEquipment] } : base) as T

  const draft: SessionDraftV1 = {
    schemaVersion: 1,
    session: { name: 'Aerobic 2000' },
    drills: [
      {
        name: 'Warmup',
        repeatCount: 1,
        items: [{ distance: 200, stroke: firstStroke, repeatCount: 1, intensity: 'v1' }],
      },
      {
        name: 'Main set',
        repeatCount: 1,
        items: [
          equipped({ distance: 100, stroke: firstStroke, repeatCount: 10, intensity: 'v2', interval: '1:30' }),
          equipped({ distance: 50, stroke: secondStroke, repeatCount: 4, intensity: 'v2' }),
        ],
      },
    ],
  }
  const plan = [
    'Warmup: one 200m step, easy',
    'Main set: 10 x 100m, then 4 x 50m',
  ]
  return { outcome: 'draft', plan, draft }
}

export function buildSystemPrompt(context: SessionDraftContext): string {
  const equipmentList = context.equipmentOptions.length > 0 ? context.equipmentOptions.join(', ') : '(none enabled)'
  const strokeList = defaultSessionDraftConfig.strokeValues.join(', ')
  const intensityLines = (Object.entries(defaultSessionDraftConfig.intensityLabels) as [IntensityV1, string][])
    .map(([v, label]) => `${label} -> "${v}"`)
    .join(', ')
  return [
    'You are a swimming workout assistant for a coach. You complete a session',
    'draft as JSON. Respond with exactly one JSON object, no prose:',
    '{ "outcome": "draft", "plan": ["..."], "draft": <the draft object defined below> }',
    'or, when the request is not a concrete training session (a question, chit-chat,',
    'or missing any workout detail), instead:',
    '{ "outcome": "not_actionable", "message": "..." }',
    '',
    'The plan is a display-only caption of what you decided, one short line per',
    'drill, in order. Methods and reasons go there — but it is worth little next to',
    `the draft, so keep each line to at most ${defaultSessionDraftConfig.limits.maxSessionPlanLineWords} words, telegraphic,`,
    `never a full sentence. If a line needs more than ${defaultSessionDraftConfig.limits.maxSessionPlanLineSplitWords} words, that line is`,
    'probably describing two drills — split it. Say what you decided, not what you',
    'are about to do — "Warmup: one 400m step at easy", not "I will add a warmup".',
    '',
    'The draft must match this JSON Schema exactly. Every field carries a comment',
    'explaining what it means — read them, they are the specification:',
    JSON.stringify(buildDraftJsonSchema(defaultSessionDraftConfig, context), null, 2),
    '',
    'A complete valid draft outcome looks exactly like this:',
    JSON.stringify(buildExampleResult(context), null, 2),
    '',
    'Building the drills matters most. drills is the session in order; each drill',
    'is a named block; each item inside a drill is one step swum a number of times.',
    'An item is never a drill: it never carries name, and never its own nested items.',
    'If you want a named step, make it a drill instead of an item.',
    '',
    'A drill\'s name is its identity. Its steps cannot tell two drills apart —',
    '"Fingertip Drag", "Scull", "Single Arm Pull" and "3-5-7 Breathing" are all',
    '100m freestyle, and they are different drills because of what they ask the',
    'swimmer to do. Name the technique, not the block: prefer a name from the',
    'library catalogue when one fits, and use the optional description only when',
    'the name alone would not tell a coach what to do.',
    '',
    'Split the coach\'s words into drills first, then fill each drill in.',
    'Work through the input one clause at a time and decide, for each clause, whether',
    'it is its own drill or a step within a drill you already have.',
    '',
    'First ask: are every repetition of it identical?',
    '',
    '  Identical -> one step, and give that step a repeatCount.',
    '    "3 x 100m"     -> one step of 100m, repeatCount 3.',
    '    "4 x 50m fast" -> one step of 50m freestyle, repeatCount 4, at v4.',
    '',
    '  Not identical -> one step per variation, each with repeatCount 1.',
    '    "3 x 100m easy, medium, hard" -> three steps of 100m freestyle,',
    '      each repeatCount 1, at v1, v2 and v4.',
    '',
    'Never split an identical repetition into separate steps, and never fold a real',
    'variation into one step\'s repeatCount — either one loses what the coach asked',
    'for. Distance, stroke and equipment changing also make steps not identical,',
    'even when the effort does not.',
    '',
    'Then ask, separately: does the coach repeat the whole block?',
    '',
    '  A drill\'s repeatCount is for repeating the whole block of steps below it.',
    '  A step\'s repeatCount is for repeating that one step. Choosing the wrong level',
    '  is the most common mistake, so decide deliberately:',
    '',
    '    "400m warmup" -> one drill, one step of 400m. Both counts 1.',
    '',
    '    "2* 300, first at 2:00 per 100m, second with paddles at 1:50 per 100m"',
    '    -> one drill repeated twice, holding two steps of 300m:',
    '       step 1 is 300m at "2:00", step 2 is 300m with paddles at "1:50".',
    '       The 2 belongs on the drill because the whole two-step block repeats;',
    '       each step repeats once inside one pass.',
    '',
    'Use the drill\'s repeatCount when the coach repeats a block of steps. Use a',
    'step\'s repeatCount when they repeat one stroke. Leave the other at 1.',
    '',
    'Set effort, recovery and equipment per step, never per drill: a block whose',
    'steps differ is exactly what the step level is for.',
    '',
    'Reading the coach\'s phrasing:',
    '"3 x 100m easy" means one item, distance 100, repeatCount 3, at v1.',
    '"3 x 100m easy, medium, hard" means three items, each distance 100 and',
    'repeatCount 1, at v1, v2 and v4 respectively.',
    'When only some repeats use equipment, split them into separate steps so',
    'equipment applies only to those repeats.',
    'Set effort per step, not per drill, and omit intensity entirely when the coach',
    'gave no effort cue.',
    '',
    `Pool length is ${context.poolLength} ${context.distanceUnits}. Honor the recent`,
    'session shapes for plausibility of distance and structure, but invent a fresh,',
    'coherent workout. Keep total repeats and item counts reasonable.',
    'Return the full draft object (do not omit fields) when outcome is "draft".',
  ].join('\n')
}

export function buildUserContent(request: SessionDraftRequest): string {
  return [
    `Prompt: ${request.prompt}`,
    '',
    'Context (structural only, no swimmer data):',
    JSON.stringify(request.context),
    '',
    'Seed template to complete (return the full object, do not omit fields):',
    JSON.stringify(request.seed),
  ].join('\n')
}

// Appended as a follow-up user turn when a prior attempt failed validation. It
// restates the failure and the invalid response so the model can correct itself
// instead of the harness giving up. Kept terse and free of swimmer data.
export function buildCorrectionPrompt(error: string, priorResponse: string): string {
  return [
    'Your previous response could not be used, so this attempt must correct it.',
    `Error: ${error}`,
    'Your prior (invalid) response was:',
    '```',
    priorResponse,
    '```',
    'Return ONLY the corrected JSON object that satisfies the schema — no prose,',
    'no commentary, no code fences. Fix the error above and keep everything else',
    'valid.',
  ].join('\n')
}
