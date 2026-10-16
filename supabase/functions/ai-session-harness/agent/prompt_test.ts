// Agent prompt construction.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import { buildSystemPrompt, buildUserContent, buildExampleResult } from './prompt.ts'
import { buildDraftJsonSchema } from '../../../../shared/sessionDraft/schema.ts'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config.ts'
import { validateSessionDraft, validateHarnessResult } from './output.ts'
import type { SessionDraftContext, SessionDraftRequest } from './contract.ts'

const context: SessionDraftContext = {
  poolLength: 25,
  distanceUnits: 'm',
  groupNames: [],
  equipmentOptions: ['fins'],
  recentSessions: [],
}

// The prompt used to carry these facts as prose. They now live in the embedded
// schema, so these assert the information reaches the model rather than how it
// is worded.

Deno.test('system prompt includes equipment options and pool length', () => {
  const prompt = buildSystemPrompt({
    poolLength: 25,
    distanceUnits: 'm',
    groupNames: ['Squad A'],
    equipmentOptions: ['fins', 'pullbuoy'],
    recentSessions: [],
  })
  assert(prompt.includes('25 m'))
  assert(prompt.includes('"fins"'))
  assert(prompt.includes('"pullbuoy"'))
})

Deno.test('system prompt derives strokes and intensity labels from the shared config', () => {
  const prompt = buildSystemPrompt({
    poolLength: 50,
    distanceUnits: 'm',
    groupNames: [],
    equipmentOptions: [],
    recentSessions: [],
  })
  for (const stroke of defaultSessionDraftConfig.strokeValues) {
    assert(prompt.includes(`"${stroke}"`))
  }
  assert(prompt.includes('v1 (easy'))
  assert(prompt.includes('v4 (hard'))
})

Deno.test('system prompt says so when no equipment is enabled', () => {
  const prompt = buildSystemPrompt({
    poolLength: 50,
    distanceUnits: 'm',
    groupNames: [],
    equipmentOptions: [],
    recentSessions: [],
  })
  assert(prompt.includes('No equipment is enabled'))
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

// The prompt used to describe the draft's fields in prose, which models elided
// or guessed at. The JSON Schema states the shape precisely and carries a
// description per field, so it has to actually reach the model.

// The single most common thing the model gets wrong is which level a repeat
// count belongs at. These rules were derived from real failures, so the
// distinctions are pinned rather than left to the example alone.

Deno.test('the prompt explains splitting the input into drills first', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes('Split the coach'))
  assert(prompt.includes('into drills first'))
})

Deno.test('the prompt distinguishes a block repeat from a step repeat', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes("A drill's repeatCount is for repeating the whole block"))
  assert(prompt.includes("A step's repeatCount is for repeating that one step"))
})

Deno.test('the prompt shows the ambiguous 2* case as one drill with two steps', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes('2* 300'))
  assert(prompt.includes('one drill repeated twice, holding two steps'))
})

Deno.test('the prompt shows 3 x 100m as one step repeated, not the whole drill', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes("one step of 100m with the step's repeatCount to 3"))
  assert(prompt.includes('not the drill'))
})

Deno.test('the system prompt embeds the draft JSON schema', () => {
  const prompt = buildSystemPrompt(context)
  const schema = buildDraftJsonSchema(defaultSessionDraftConfig, context)
  assert(prompt.includes(JSON.stringify(schema, null, 2)))
})

Deno.test('the system prompt presents the schema before the worked example', () => {
  const prompt = buildSystemPrompt(context)
  assert(
    prompt.indexOf('"schemaVersion"') < prompt.indexOf('A complete valid draft outcome'),
    'schema must come before the example',
  )
})

Deno.test('the schema in the prompt documents every drill field', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes('Never nest one drill inside another'))
  assert(prompt.includes('independent of the drill'))
})
