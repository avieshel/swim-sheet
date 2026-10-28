// Agent prompt construction.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import { buildSystemPrompt, buildUserContent, buildExampleResult } from './prompt.ts'
import { buildDraftJsonSchema } from '../shared/sessionDraft/schema.ts'
import { defaultSessionDraftConfig } from '../shared/sessionDraft/config.ts'
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
  assert(prompt.includes('"3 x 100m"     -> one step of 100m, repeatCount 3'))
  assert(prompt.includes('A step\'s repeatCount is for repeating that one step'))
})

// The rule for choosing between the two: are the repetitions identical?
Deno.test('the prompt decides reps vs steps by whether repetitions are identical', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes('every repetition of it identical'))
  assert(prompt.includes('one step, and give that step a repeatCount'))
  assert(prompt.includes('not identical'))
  assert(prompt.includes('one step per variation'))
})

Deno.test('the prompt shows the identical case as one step with repeats', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes('4 x 50m fast'))
})

Deno.test('the prompt shows the varied case as one step per intensity', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes('3 x 100m easy, medium, hard'))
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

// Production traces (2026-10-26/27) show otherwise-valid drafts rejected because
// a plan line exceeded 100 characters: the prompt asked for sentence-shaped plan
// lines but never showed one, and character counts are not countable by models.
// The example must carry real plan lines, and the rule must be a word budget.

Deno.test('the example carries plan lines that meet the plan limits', () => {
  const example = buildExampleResult(context)
  assert(example.plan !== undefined, 'the example must show plan lines')
  for (const line of example.plan) {
    assert(
      line.length <= defaultSessionDraftConfig.limits.maxSessionPlanLineLength,
      `plan line too long: ${line}`,
    )
    assert(
      line.split(/\s+/).length <= defaultSessionDraftConfig.limits.maxSessionPlanLineWords,
      `plan line too wordy: ${line}`,
    )
  }
})

Deno.test('the example plan has one line per drill', () => {
  const example = buildExampleResult(context)
  assertEquals(example.plan?.length, example.draft.drills.length)
})

Deno.test('the prompt gives a soft word budget for plan lines with a split flag', () => {
  const prompt = buildSystemPrompt(context)
  const limits = defaultSessionDraftConfig.limits
  assert(
    prompt.includes(`at most ${limits.maxSessionPlanLineWords} words`),
    'the comfortable budget must be countable',
  )
  assert(
    prompt.includes(`more than ${limits.maxSessionPlanLineSplitWords} words`),
    'a line past the split threshold must be read as complexity, not failure',
  )
  assert(prompt.includes('split'), 'the response to the flag is to split the drill')
})

Deno.test('the prompt drops the character budget for plan lines', () => {
  const prompt = buildSystemPrompt(context)
  assert(
    !prompt.includes(`at most ${defaultSessionDraftConfig.limits.maxSessionPlanLineLength} characters`),
    'character counts are not countable by the model',
  )
})

Deno.test('the plan word budget sits at the plan definition, before the schema', () => {
  const prompt = buildSystemPrompt(context)
  const planIntro = prompt.indexOf('The plan is a display-only caption')
  const budget = prompt.indexOf('words')
  const schema = prompt.indexOf('The draft must match')
  assert(planIntro !== -1 && budget !== -1 && schema !== -1)
  assert(planIntro < budget && budget < schema)
})

Deno.test('the prompt calls the plan display-only', () => {
  const prompt = buildSystemPrompt(context)
  assert(prompt.includes('display-only'))
})
