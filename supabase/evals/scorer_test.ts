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

// "3 x 100m" is contract-valid in two encodings: three repeats on the item, or
// a drill repeated three times around a single item. Both render identically,
// because distance is item.distance * item.repeatCount * drill.repeatCount.
// The scorer flattened items across drills and dropped the drill-level repeat,
// so it measured the wrong total and missed valid drafts.

const drillLevelRepeats: SessionDraftV1 = {
  schemaVersion: 1,
  session: { name: 'Sample' },
  drills: [
    {
      name: 'Main',
      repeatCount: 10,
      items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1, intensity: 'v1' }],
    },
  ],
}

Deno.test('totalDistance counts drill-level repeats', () => {
  const res = scoreDraft(drillLevelRepeats, [{ kind: 'totalDistance', min: 900, max: 1100 }])
  assert(res.passed)
  assertEquals(res.failures, [])
})

Deno.test('repeatCountForDistance accepts drill-level repeats', () => {
  const res = scoreDraft(drillLevelRepeats, [{ kind: 'repeatCountForDistance', distance: 100, repeatCount: 10 }])
  assert(res.passed)
  assertEquals(res.failures, [])
})

Deno.test('repeatCountForDistance still accepts item-level repeats', () => {
  const res = scoreDraft(sampleDraft, [{ kind: 'repeatCountForDistance', distance: 100, repeatCount: 3 }])
  assert(res.passed)
})

Deno.test('totalDistance multiplies both levels', () => {
  const both: SessionDraftV1 = {
    schemaVersion: 1,
    session: { name: 'Sample' },
    drills: [
      {
        name: 'Main',
        repeatCount: 5,
        items: [{ distance: 100, stroke: 'freestyle', repeatCount: 2 }],
      },
    ],
  }
  // 100 * 2 * 5 = 1000
  const res = scoreDraft(both, [{ kind: 'totalDistance', min: 900, max: 1100 }])
  assert(res.passed)
  assertEquals(res.failures, [])
})
