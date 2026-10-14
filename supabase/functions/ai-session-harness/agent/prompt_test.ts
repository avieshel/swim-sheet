// Agent prompt construction.

import { assert } from 'jsr:@std/assert@1'
import { buildSystemPrompt, buildUserContent } from './prompt.ts'
import type { SessionDraftRequest } from './contract.ts'

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

Deno.test('system prompt derives strokes and intensity labels from the shared config', () => {
  const prompt = buildSystemPrompt({
    poolLength: 50,
    distanceUnits: 'm',
    groupNames: [],
    equipmentOptions: [],
    recentSessions: [],
  })
  assert(prompt.includes('freestyle, backstroke, breaststroke, butterfly, im'))
  assert(prompt.includes('easy -> "v1"'))
  assert(prompt.includes('hard -> "v4"'))
  assert(prompt.includes('(none enabled)'))
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
  assert(content.includes('"schemaVersion":1'))
})
