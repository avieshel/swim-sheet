// Agent output validation: shared contract, bound to the default config.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import { validateHarnessResult, validateSessionDraft } from './output.ts'

const validDraft = {
  schemaVersion: 1,
  session: { name: 'Tuesday Endurance' },
  drills: [
    {
      name: 'Warmup',
      repeatCount: 1,
      items: [{ distance: 100, stroke: 'freestyle', repeatCount: 2 }],
    },
  ],
} as const

function draftWithItem(item: Record<string, unknown>): unknown {
  return {
    schemaVersion: 1,
    session: { name: 'X' },
    drills: [{ name: 'D', repeatCount: 1, items: [item] }],
  }
}

Deno.test('validateHarnessResult accepts a well-formed draft', () => {
  const result = validateHarnessResult({ outcome: 'draft', draft: validDraft })
  assert(result.ok)
  if (result.ok && result.value.outcome === 'draft') {
    assertEquals(result.value.draft.session.name, 'Tuesday Endurance')
    assertEquals(result.value.draft.drills[0].items[0].distance, 100)
  }
})

Deno.test('validateHarnessResult accepts not_actionable', () => {
  const result = validateHarnessResult({ outcome: 'not_actionable', message: 'Not a session.' })
  assert(result.ok)
  if (result.ok && result.value.outcome === 'not_actionable') {
    assertEquals(result.value.message, 'Not a session.')
  }
})

Deno.test('validateHarnessResult rejects unknown outcome', () => {
  assert(!validateHarnessResult({ outcome: 'nope' }).ok)
})

Deno.test('validateSessionDraft rejects extra fields', () => {
  const result = validateSessionDraft({
    schemaVersion: 1,
    session: { name: 'X' },
    drills: [{ name: 'D', repeatCount: 1, items: [{ distance: 50, stroke: 'im', repeatCount: 1 }], secret: 1 }],
  })
  assert(!result.ok)
})

Deno.test('validateSessionDraft rejects bad intensity', () => {
  assert(!validateSessionDraft(draftWithItem({ distance: 50, stroke: 'im', repeatCount: 1, intensity: 'v9' })).ok)
})

Deno.test('validateSessionDraft rejects unsupported equipment', () => {
  assert(!validateSessionDraft(draftWithItem({ distance: 50, stroke: 'im', repeatCount: 1, equipment: ['monofin'] })).ok)
})

Deno.test('validateSessionDraft rejects a distance above the configured cap', () => {
  const result = validateSessionDraft(draftWithItem({ distance: 20_000, stroke: 'im', repeatCount: 1 }))
  assert(!result.ok)
  if (!result.ok) assertEquals(result.error.code, 'limit_exceeded')
})

Deno.test('validateSessionDraft rejects a repeatCount above the configured cap', () => {
  const result = validateSessionDraft(draftWithItem({ distance: 50, stroke: 'im', repeatCount: 500 }))
  assert(!result.ok)
  if (!result.ok) assertEquals(result.error.code, 'limit_exceeded')
})

Deno.test('validateSessionDraft rejects an unparseable interval', () => {
  assert(!validateSessionDraft(draftWithItem({ distance: 50, stroke: 'im', repeatCount: 1, interval: 'whenever' })).ok)
})

Deno.test('validateSessionDraft accepts a parseable interval', () => {
  assert(validateSessionDraft(draftWithItem({ distance: 50, stroke: 'im', repeatCount: 1, interval: '1:30' })).ok)
  assert(validateSessionDraft(draftWithItem({ distance: 50, stroke: 'im', repeatCount: 1, interval: 'RI 20s' })).ok)
})
