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

// A complete, valid response built from the shared config. The system prompt
// used to elide the inner draft as `{ ... }`, which left weaker models to guess
// that `session` was an object rather than a bare string — a guess the strict
// validator then rejected. Showing a real example removes the guesswork, and
// deriving it from the config keeps it from drifting out of contract.
export type DraftHarnessResult = Extract<HarnessResult, { outcome: 'draft' }>

export function buildExampleResult(context: SessionDraftContext): DraftHarnessResult {
  const enabledEquipment = context.equipmentOptions[0]
  const draft: SessionDraftV1 = {
    schemaVersion: 1,
    session: { name: 'Aerobic 2000' },
    drills: [
      {
        name: 'Main set',
        repeatCount: 1,
        items: [
          {
            distance: 100,
            stroke: defaultSessionDraftConfig.strokeValues[0],
            repeatCount: 10,
            intensity: 'v2',
            interval: '1:30',
            ...(enabledEquipment ? { equipment: [enabledEquipment] } : {}),
          },
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
    'draft as JSON. Respond with exactly one JSON object, no prose, of this shape:',
    '{ "outcome": "draft", "draft": { ... } }',
    'or, when the request is not a concrete training session (a question, chit-chat,',
    'or missing any workout detail), this shape instead:',
    '{ "outcome": "not_actionable", "message": "..." }',
    '',
    'A complete valid draft outcome looks exactly like this:',
    JSON.stringify(buildExampleResult(context), null, 2),
    '',
    'The draft uses schemaVersion 1. session is an object with a single name key,',
    'never a bare string. drills is a non-empty array; each drill has name (string),',
    'repeatCount (positive integer), and items (non-empty array). Each item has',
    `distance (positive integer, meters), stroke (one of ${strokeList}), repeatCount`,
    '(positive integer).',
    '',
    `Intensity is optional. Map effort cues: ${intensityLines}. Omit intensity when there is no effort cue.`,
    'interval is an optional short string like "1:30" or "RI 20s".',
    `equipment is an optional array restricted to these enabled ids: ${equipmentList}.`,
    '',
    'Repeat semantics: "3 x 100m easy" means one item with distance 100 and',
    'repeatCount 3 at v1. "3 x 100m easy, medium, hard" means three items, each',
    'distance 100, repeatCount 1, at v1, v2, and v4. When only some repeats use',
    'equipment, split into separate items so equipment applies only to those repeats.',
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
