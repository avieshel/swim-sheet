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
    prompt:
      'A 2000m aerobic set for a club squad: 300 free warmup, then 10x100 freestyle on 1:40 at moderate effort, finish with 4x50 backstroke easy.',
    expectation: {
      outcome: 'draft',
      requirements: [
        { kind: 'drillCount', min: 2, max: 8 },
        { kind: 'totalDistance', min: 1600, max: 2400 },
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
]
