// Inbound request validation: shape and config-driven bounds.

import { assertEquals } from 'jsr:@std/assert@1'
import { validateRequest } from './request.ts'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config.ts'

const baseSeed = { schemaVersion: 1, session: { name: '' }, drills: [] }
const baseContext = { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: [], recentSessions: [] }

function withContext(context: unknown) {
  return { prompt: 'Plan a set', seed: baseSeed, context }
}

Deno.test('accepts a well-formed request', () => {
  assertEquals(validateRequest({ prompt: 'Plan a set', seed: baseSeed, context: baseContext }).ok, true)
})

Deno.test('flags an over-long prompt as prompt_too_long', () => {
  const result = validateRequest({
    prompt: 'x'.repeat(defaultSessionDraftConfig.limits.maxPromptLength + 1),
    seed: baseSeed,
    context: baseContext,
  })
  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.reason, 'prompt_too_long')
})

Deno.test('rejects a non-empty seed name', () => {
  const result = validateRequest({
    prompt: 'Plan a set',
    seed: { schemaVersion: 1, session: { name: 'X' }, drills: [] },
    context: baseContext,
  })
  assertEquals(result.ok, false)
})

Deno.test('rejects an unexpected context field', () => {
  assertEquals(validateRequest(withContext({ ...baseContext, secret: 1 })).ok, false)
})

Deno.test('rejects an unsupported equipment id', () => {
  assertEquals(validateRequest(withContext({ ...baseContext, equipmentOptions: ['monofin'] })).ok, false)
})

Deno.test('rejects a groupNames list beyond the configured cap', () => {
  const names = Array.from({ length: defaultSessionDraftConfig.limits.maxGroupNames + 1 }, (_, i) => `Group ${i}`)
  assertEquals(validateRequest(withContext({ ...baseContext, groupNames: names })).ok, false)
})

Deno.test('rejects more recent sessions than the configured cap', () => {
  const sessions = Array.from({ length: defaultSessionDraftConfig.limits.maxRecentSessions + 1 }, () => ({
    totalDistance: 1000,
    drills: [{ distance: 100, stroke: 'freestyle', repeatCount: 10 }],
  }))
  assertEquals(validateRequest(withContext({ ...baseContext, recentSessions: sessions })).ok, false)
})

Deno.test('rejects a recent session with an unsupported field', () => {
  const sessions = [{ totalDistance: 1000, drills: [], extra: true }]
  assertEquals(validateRequest(withContext({ ...baseContext, recentSessions: sessions })).ok, false)
})
