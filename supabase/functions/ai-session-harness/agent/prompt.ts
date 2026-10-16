// Builds the provider request content. The prompt deliberately receives only
// the sanitized coach text and structural context — no swimmer names, roster
// counts, session notes, or drill-library contents.

import type {
  HarnessResult,
  SessionDraftContext,
  SessionDraftRequest,
  SessionDraftV1,
} from './contract.ts'
import type { IntensityV1 } from '../../../../shared/sessionDraft/types.ts'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config.ts'
import { buildDraftJsonSchema } from '../../../../shared/sessionDraft/schema.ts'

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
  return { outcome: 'draft', draft }
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
    '{ "outcome": "draft", "draft": <the draft object defined below> }',
    'or, when the request is not a concrete training session (a question, chit-chat,',
    'or missing any workout detail), instead:',
    '{ "outcome": "not_actionable", "message": "..." }',
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
