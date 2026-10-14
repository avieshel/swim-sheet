// Deno unit tests for the pure scorer. Run: deno test evals/scorer_test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { scoreDraft, scoreResult } from './scorer.ts'
import type { SessionDraftV1 } from '../functions/ai-session-harness/agent/contract.ts'

const sampleDraft: SessionDraftV1 = {
  schemaVersion: 1,
  session: { name: 'Sample' },
  drills: [
    {
      name: 'Main',
      repeatCount: 1,
      items: [
        { distance: 100, stroke: 'freestyle', repeatCount: 3, intensity: 'v1' },
        { distance: 100, stroke: 'freestyle', repeatCount: 3, intensity: 'v2' },
        { distance: 100, stroke: 'freestyle', repeatCount: 1, intensity: 'v4', equipment: ['fins'] },
        { distance: 50, stroke: 'backstroke', repeatCount: 4 },
      ],
    },
  ],
}

Deno.test('scoreDraft passes when all requirements match', () => {
  const res = scoreDraft(sampleDraft, [
    { kind: 'totalDistance', min: 600, max: 900 },
    { kind: 'hasStroke', stroke: 'freestyle' },
    { kind: 'itemWithIntensity', intensity: 'v4' },
    { kind: 'hasEquipment', id: 'fins' },
    { kind: 'repeatCountForDistance', distance: 100, repeatCount: 3 },
  ])
  assert(res.passed)
  assertEquals(res.failures, [])
})

Deno.test('scoreDraft reports each unmet requirement', () => {
  const res = scoreDraft(sampleDraft, [
    { kind: 'totalDistance', min: 5000, max: 6000 },
    { kind: 'hasStroke', stroke: 'butterfly' },
    { kind: 'itemWithIntensity', intensity: 'v3' },
  ])
  assert(!res.passed)
  assertEquals(res.failures.length, 3)
})

Deno.test('scoreResult enforces outcome mismatch', () => {
  const res = scoreResult({ outcome: 'not_actionable', message: 'nope' }, { outcome: 'draft' })
  assert(!res.passed)
  assertEquals(res.failures[0], 'expected outcome draft, got not_actionable')
})

Deno.test('scoreResult short-circuits for not_actionable', () => {
  const res = scoreResult({ outcome: 'not_actionable', message: 'not a session' }, { outcome: 'not_actionable' })
  assert(res.passed)
})
