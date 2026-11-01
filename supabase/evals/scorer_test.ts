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

// A list of distinct technique drills ("50 kick, 50 scull, 50 fists") is the
// failure that produced a generic "Technique Warmup" of six identical steps in
// production: structurally legal, semantically wrong. The technique identity
// lives on the drill name, so distinctness across drills is what to assert.

const wristTap: SessionDraftV1 = {
  schemaVersion: 1,
  session: { name: 'Clinic' },
  drills: [
    { name: 'Fingertip Drag', repeatCount: 1, items: [{ distance: 50, stroke: 'freestyle', repeatCount: 1 }] },
    { name: 'Scull', repeatCount: 1, items: [{ distance: 50, stroke: 'freestyle', repeatCount: 1 }] },
    { name: 'Fist Drill', repeatCount: 1, items: [{ distance: 50, stroke: 'freestyle', repeatCount: 1 }] },
    { name: 'Kick', repeatCount: 1, items: [{ distance: 50, stroke: 'freestyle', repeatCount: 1 }] },
  ],
}

Deno.test('distinctDrillNames counts unique names across drills', () => {
  const res = scoreDraft(wristTap, [{ kind: 'distinctDrillNames', min: 4 }])
  assert(res.passed)
})

Deno.test('distinctDrillNames fails a single lumped drill', () => {
  const lumped: SessionDraftV1 = {
    schemaVersion: 1,
    session: { name: 'Session' },
    drills: [
      {
        name: 'Technique Warmup',
        repeatCount: 1,
        items: [{ distance: 50, stroke: 'freestyle', repeatCount: 4 }],
      },
    ],
  }
  const res = scoreDraft(lumped, [{ kind: 'distinctDrillNames', min: 4 }])
  assert(!res.passed)
  assertEquals(res.failures.length, 1)
})

Deno.test('descriptionMentions matches any given term case-insensitively', () => {
  const described: SessionDraftV1 = {
    schemaVersion: 1,
    session: { name: 'Sample' },
    drills: [
      {
        name: 'Descending 100s',
        description: 'Each 100 is faster: descend 1 to 3.',
        repeatCount: 1,
        items: [{ distance: 100, stroke: 'freestyle', repeatCount: 3 }],
      },
    ],
  }
  const res = scoreDraft(described, [{ kind: 'descriptionMentions', any: ['descend', 'progress'] }])
  assert(res.passed)
  const undescribed: SessionDraftV1 = {
    schemaVersion: 1,
    session: { name: 'Sample' },
    drills: [
      { name: 'Main set', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 3 }] },
    ],
  }
  const miss = scoreDraft(undescribed, [{ kind: 'descriptionMentions', any: ['descend', 'progress'] }])
  assert(!miss.passed)
})

// Progression is valid in two encodings — extra-room text on the drill, or
// stepped intensities across its items — so the requirement is an anyOf.

const stepped: SessionDraftV1 = {
  schemaVersion: 1,
  session: { name: 'Sample' },
  drills: [
    {
      name: 'Descend',
      repeatCount: 1,
      items: [
        { distance: 100, stroke: 'freestyle', repeatCount: 1, intensity: 'v2' },
        { distance: 100, stroke: 'freestyle', repeatCount: 1, intensity: 'v3' },
        { distance: 100, stroke: 'freestyle', repeatCount: 1, intensity: 'v4' },
      ],
    },
  ],
}

Deno.test('distinctIntensities counts the effort range a draft covers', () => {
  const res = scoreDraft(stepped, [{ kind: 'distinctIntensities', min: 3 }])
  assert(res.passed)
  const flat = scoreDraft(sampleDraft, [{ kind: 'distinctIntensities', min: 5 }])
  assert(!flat.passed)
})

Deno.test('distinctItemDescriptions counts technique detail that survives on steps', () => {
  const described: SessionDraftV1 = {
    schemaVersion: 1,
    session: { name: 'Warmup' },
    drills: [
      {
        name: 'Warmup',
        repeatCount: 1,
        items: [
          { distance: 50, stroke: 'freestyle', repeatCount: 1, description: 'Kick' },
          { distance: 50, stroke: 'freestyle', repeatCount: 1, description: 'Fist drill' },
          { distance: 50, stroke: 'freestyle', repeatCount: 1, description: 'Scull' },
          { distance: 50, stroke: 'freestyle', repeatCount: 1, description: 'Dog paddle' },
        ],
      },
    ],
  }
  assert(scoreDraft(described, [{ kind: 'distinctItemDescriptions', min: 4 }]).passed)
  // Repeated descriptions count once; an anon block yields zero.
  const collapsed: SessionDraftV1 = {
    schemaVersion: 1,
    session: { name: 'Warmup' },
    drills: [
      {
        name: 'Warmup',
        repeatCount: 1,
        items: [
          { distance: 50, stroke: 'freestyle', repeatCount: 1 },
          { distance: 50, stroke: 'freestyle', repeatCount: 1 },
          { distance: 50, stroke: 'freestyle', repeatCount: 1 },
        ],
      },
    ],
  }
  assert(!scoreDraft(collapsed, [{ kind: 'distinctItemDescriptions', min: 4 }]).passed)
})

Deno.test('anyOf passes when one branch is met', () => {
  const res = scoreDraft(stepped, [
    {
      kind: 'anyOf',
      requirements: [
        { kind: 'descriptionMentions', any: ['descend'] },
        { kind: 'distinctIntensities', min: 3 },
      ],
    },
  ])
  assert(res.passed)
  const none = scoreDraft(sampleDraft, [
    {
      kind: 'anyOf',
      requirements: [
        { kind: 'descriptionMentions', any: ['descend'] },
        { kind: 'hasStroke', stroke: 'butterfly' },
      ],
    },
  ])
  assert(!none.passed)
})
