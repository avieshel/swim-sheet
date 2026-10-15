// Agent prompt construction.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import { buildSystemPrompt, buildUserContent, buildExampleResult } from './prompt.ts'
import { validateSessionDraft, validateHarnessResult } from './output.ts'
import type { SessionDraftContext, SessionDraftRequest } from './contract.ts'

const context: SessionDraftContext = {
  poolLength: 25,
  distanceUnits: 'm',
  groupNames: [],
  equipmentOptions: ['fins'],
  recentSessions: [],
}

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

// The system prompt used to describe the inner draft as `{ ... }`, which left
// small models to guess that `session` was an object rather than a string. The
// example is now generated from the shared config, so it can never drift from
// the contract — and these tests hold it to that.

Deno.test('the example draft is itself valid under the shared validator', () => {
  assert(validateSessionDraft(buildExampleResult(context).draft).ok)
  assert(validateHarnessResult(buildExampleResult(context)).ok)
})

Deno.test('the example uses only equipment the context actually enables', () => {
  const example = buildExampleResult(context)
  const item = example.draft.drills[0].items[0]
  for (const id of item.equipment ?? []) {
    assert(context.equipmentOptions.includes(id))
  }
})

Deno.test('the example omits equipment entirely when none is enabled', () => {
  const example = buildExampleResult({ ...context, equipmentOptions: [] })
  assertEquals(example.draft.drills[0].items[0].equipment, undefined)
})

Deno.test('the system prompt embeds the example verbatim', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes(JSON.stringify(buildExampleResult(context), null, 2)))
})
