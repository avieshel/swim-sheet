// Synthetic eval corpus for the AI session harness.
//
// Each case declares a coach prompt, the expected outcome, and (for actionable
// requests) checkable structural requirements. The corpus is committed and runs
// under `deno test` (scorer only) and under the opt-in `run.ts` live runner.

import type { SessionDraftContext } from '../functions/ai-session-harness/agent/contract.ts'
import type { EvalExpectation } from './scorer.ts'

export interface EvalCase {
  id: string
  prompt: string
  expectation: EvalExpectation
}

export function defaultContext(): SessionDraftContext {
  return {
    poolLength: 25,
    distanceUnits: 'm',
    groupNames: [],
    equipmentOptions: ['fins', 'paddles', 'pullbuoy', 'snorkel'],
    recentSessions: [],
  }
}

export const cases: EvalCase[] = [
  {
    id: 'aerobic-2000-freestyle',
    // The itemised parts sum to 1500m (300 + 10x100 + 4x50), so the expectation
    // tracks the structure the prompt actually describes. It previously expected
    // 1600-2400m — matching only the "2000m" framing in the first clause — and
    // so failed every faithful completion. Whether the agent should pad out to a
    // stated total is a product question, not current behaviour.
    prompt:
      'A 2000m aerobic set for a club squad: 300 free warmup, then 10x100 freestyle on 1:40 at moderate effort, finish with 4x50 backstroke easy.',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'drillCount', min: 2, max: 8 },
        { kind: 'totalDistance', min: 1400, max: 1600 },
        { kind: 'hasStroke', stroke: 'freestyle' },
        { kind: 'itemWithIntensity', intensity: 'v2' },
      ],
    },
  },
  {
    id: 'repeat-3x100-easy',
    prompt: '3 x 100m easy freestyle as a warmup.',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'repeatCountForDistance', distance: 100, repeatCount: 3 },
        { kind: 'itemWithIntensity', intensity: 'v1' },
      ],
    },
  },
  {
    id: 'varied-intensity-3x100',
    prompt: '3 x 100m: first easy, second medium, third hard. All freestyle.',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'itemWithIntensity', intensity: 'v1' },
        { kind: 'itemWithIntensity', intensity: 'v2' },
        { kind: 'itemWithIntensity', intensity: 'v4' },
      ],
    },
  },
  {
    id: 'equipment-on-last-repeat',
    prompt: '4 x 100m freestyle, the last one with fins.',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'hasEquipment', id: 'fins' },
        { kind: 'itemDistance', distance: 100 },
      ],
    },
  },
  {
    id: 'non-session-weather',
    prompt: 'What is the weather like today?',
    expectation: { outcome: 'not_actionable' },
  },
  {
    id: 'non-session-joke',
    prompt: 'Tell me a swimming joke.',
    expectation: { outcome: 'not_actionable' },
  },
  {
    // The production failure that shipped a generic 'Technique Warmup' of six
    // identical 50m steps: the model lumped separately named techniques into
    // one block. Each technique now survives as its own step description inside
    // one "Warmup" drill, so we assert distinct step descriptions, not distinct
    // drill names.
    id: 'technique-warmup-named-drills',
    prompt: 'Warmup: 50 kick, 50 fists, 50 sculling, 50 single arm, 50 dog paddle.',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'distinctItemDescriptions', min: 4 },
        { kind: 'itemDistance', distance: 50 },
      ],
    },
  },
  {
    // Production (2026-11-01): a Hebrew warmup listing distinct technique 50s
    // came back as one block of six anonymous 50m steps — every technique
    // ('fists', 'scull', 'hand-to-hand', 'dog paddle') was lost. The techniques
    // must survive as step descriptions in the coach's language.
    id: 'hebrew-technique-warmup',
    prompt: 'חימום: 50 רגליים, 50 אגרופים, 50 שריטת מים, 50 יד יד, 50 כלב, 50 רגליים',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'hasStroke', stroke: 'freestyle' },
        { kind: 'itemDistance', distance: 50 },
        { kind: 'distinctItemDescriptions', min: 4 },
        { kind: 'descriptionMentions', any: ['אגרופים', 'fist'] },
      ],
    },
  },
  {
    // Production (2026-11-01): a full Hebrew session whose technique detail was
    // dropped entirely after the validation retry loop. The named technique 50s
    // must survive as step descriptions through to the accepted draft.
    id: 'hebrew-full-session-technique-detail',
    prompt:
      'אימון יום ב 2/11/26\n400 חתירה\n50 רגליים\n50 אגרופים\n50 שריטת מים\n50 יד יד\n50 כלב\n50 רגליים\n2*100 חתירה יציאה 2:00\n2*100 מעורב יציאה 2:10\n100 קל\n2*200 נשימות 3:40\n3*200 מהיר 3:30\n200 קל\n4*100 סנפירים וכפות תת מימי',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'hasStroke', stroke: 'freestyle' },
        { kind: 'distinctItemDescriptions', min: 4 },
        { kind: 'descriptionMentions', any: ['אגרופים', 'fist', 'שריטת מים', 'scull'] },
      ],
    },
  },
  {
    // Production dropped 'כפות' (paddles) from 'fins and paddles', keeping only
    // the first equipment term. Both must survive.
    id: 'equipment-conjoined-fins-and-paddles',
    prompt: '4 x 100m freestyle with fins and paddles on 2:00.',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'hasEquipment', id: 'fins' },
        { kind: 'hasEquipment', id: 'paddles' },
        { kind: 'repeatCountForDistance', distance: 100, repeatCount: 4 },
      ],
    },
  },
  {
    // Progression has no schema field; the coach's gradation must survive in
    // one of the two supported encodings: extra-room text on the drill, or
    // stepped intensities across its items.
    id: 'progression-held-in-extra-room',
    prompt: '3 x 100m freestyle descending 1 to 3 on 2:00, then 200 easy.',
    expectation: {
      outcome: 'draft',
      requirements: [
        {
          kind: 'anyOf',
          requirements: [
            { kind: 'descriptionMentions', any: ['descend', 'progress'] },
            { kind: 'distinctIntensities', min: 3 },
          ],
        },
        { kind: 'itemWithIntensity', intensity: 'v1' },
      ],
    },
  },
  {
    // Coaches paste prompts in their own language (production input was
    // Hebrew). The draft must still come out structurally correct — the model
    // should not lose the plan or flip to not_actionable because the text is
    // not English.
    id: 'hebrew-input',
    prompt: 'חימום: 200 חתירה, אחר כך 4x50 רגליים עם סנפירים',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'hasStroke', stroke: 'freestyle' },
        { kind: 'itemDistance', distance: 50 },
        { kind: 'hasEquipment', id: 'fins' },
      ],
    },
  },
]
