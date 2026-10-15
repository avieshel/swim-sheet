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
  for (const drill of example.draft.drills) {
    for (const item of drill.items) {
      for (const id of item.equipment ?? []) {
        assert(context.equipmentOptions.includes(id))
      }
    }
  }
})

Deno.test('the example omits equipment entirely when none is enabled', () => {
  const example = buildExampleResult({ ...context, equipmentOptions: [] })
  for (const drill of example.draft.drills) {
    for (const item of drill.items) {
      assertEquals(item.equipment, undefined)
    }
  }
})

Deno.test('the system prompt embeds the example verbatim', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes(JSON.stringify(buildExampleResult(context), null, 2)))
})

// A one-drill, one-item example is ambiguous: a model can read `items` as
// "the things in this drill" and then nest whole drills inside it, which the
// validator rejects as unsupported fields on an item. The example therefore
// has to demonstrate the real two-level shape.

const ITEM_FIELDS = ['distance', 'stroke', 'repeatCount', 'intensity', 'interval', 'equipment']

Deno.test('the example shows more than one drill', () => {
  assert(buildExampleResult(context).draft.drills.length >= 2)
})

Deno.test('the example shows a drill with more than one item', () => {
  const drills = buildExampleResult(context).draft.drills
  assert(drills.some((drill) => drill.items.length >= 2))
})

Deno.test('no example item carries drill-shaped fields', () => {
  for (const drill of buildExampleResult(context).draft.drills) {
    for (const item of drill.items) {
      const extra = Object.keys(item).filter((key) => !ITEM_FIELDS.includes(key))
      assertEquals(extra, [], `items[${Object.keys(item).join(',')}] has unexpected fields`)
    }
  }
})

Deno.test('the system prompt forbids nesting drills inside items', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes('An item is never a drill'))
})
