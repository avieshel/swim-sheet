// Deno test for the AI session harness function.
//
// Run with: deno test --allow-env --allow-net functions/ai-session-harness/index_test.ts
// The pure modules (output validation, prompt building) are exercised directly.
// Handler-level auth/rate-limit/provider paths require Deno plus Supabase env
// and a configured provider; they are covered by the migration SQL tests and the
// client-side network-boundary tests rather than here.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import { validateHarnessResult, validateSessionDraft } from './output.ts'
import { buildSystemPrompt, buildUserContent } from './prompt.ts'
import type { SessionDraftRequest } from './contract.ts'

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

Deno.test('validateHarnessResult accepts a well-formed draft', () => {
  const result = validateHarnessResult({ outcome: 'draft', draft: validDraft })
  assert(result.ok)
  if (result.ok) {
    assertEquals(result.value.outcome, 'draft')
    assertEquals(result.value.draft.session.name, 'Tuesday Endurance')
  }
})

Deno.test('validateHarnessResult accepts not_actionable', () => {
  const result = validateHarnessResult({ outcome: 'not_actionable', message: 'Not a session.' })
  assert(result.ok)
  if (result.ok) assertEquals(result.value.outcome, 'not_actionable')
})

Deno.test('validateHarnessResult rejects unknown outcome', () => {
  const result = validateHarnessResult({ outcome: 'nope' })
  assert(!result.ok)
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
  const result = validateSessionDraft({
    schemaVersion: 1,
    session: { name: 'X' },
    drills: [
      {
        name: 'D',
        repeatCount: 1,
        items: [{ distance: 50, stroke: 'im', repeatCount: 1, intensity: 'v9' }],
      },
    ],
  })
  assert(!result.ok)
})

Deno.test('validateSessionDraft rejects unsupported equipment', () => {
  const result = validateSessionDraft({
    schemaVersion: 1,
    session: { name: 'X' },
    drills: [
      {
        name: 'D',
        repeatCount: 1,
        items: [{ distance: 50, stroke: 'im', repeatCount: 1, equipment: ['monofin'] }],
      },
    ],
  })
  assert(!result.ok)
})

Deno.test('system prompt includes equipment options and pool length', () => {
  const prompt = buildSystemPrompt({
    poolLength: 25,
    distanceUnits: 'm',
    groupNames: ['Squad A'],
    equipmentOptions: ['fins', 'pullbuoy'],
    recentSessions: [],
  })
  assert(prompt.includes('25 m'))
  assert(prompt.includes('fins, pullbuoy'))
})

Deno.test('user content embeds sanitized prompt and seed', () => {
  const request: SessionDraftRequest = {
    prompt: 'Plan a set',
    seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
    context: {
      poolLength: 50,
      distanceUnits: 'm',
      groupNames: [],
      equipmentOptions: [],
      recentSessions: [],
    },
  }
  const content = buildUserContent(request)
  assert(content.includes('Plan a set'))
  assert(content.includes('"schemaVersion": 1'))
})
