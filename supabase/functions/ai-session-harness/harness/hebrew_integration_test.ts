// End-to-end loop check: a Hebrew prompt carrying an indexed term must flow
// through the harness, the index, and the hint injection, and the draft the
// "model" returns (echoing the hinted slug) must pass the shared validator.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import { createHandler, type HandlerDeps } from './handler.ts'
import { matchDrillHints } from '../agent/matchDrills.ts'
import { validateSessionDraft, validateHarnessResult } from '../agent/output.ts'
import type { HarnessResult, SessionDraftRequest } from '../agent/contract.ts'

const HEBREW_PROMPT = '4x50 יד-יד'
const AVAILABLE_DRILLS = [
  { slug: 'single-arm-pull', name: 'Single Arm Pull', heName: 'שחייה ביד אחת', popularity: 9 },
]

// A fake model that follows the matching index: it reuses the first indexed
// slug as the draft's sourceSlug. This proves the index resolved the Hebrew
// term and the prompt carried it into the agent's view, end to end.
function makeDeps(): HandlerDeps {
  return {
    verifyUser: () => Promise.resolve({ kind: 'authenticated', userId: 'u1' }),
    recordRequest: () => Promise.resolve({ allowed: true, retry_after_seconds: 0 }),
    runAgent: (request: SessionDraftRequest) => {
      const hints = matchDrillHints(request.prompt, request.context.availableDrills ?? [])
      const slug = hints[0]?.slug
      const result: HarnessResult = slug
        ? {
            outcome: 'draft',
            draft: {
              schemaVersion: 1,
              session: { name: 'Hebrew set' },
              drills: [
                {
                  name: 'Single Arm Pull',
                  sourceSlug: slug,
                  repeatCount: 1,
                  items: [{ distance: 50, stroke: 'freestyle', repeatCount: 4 }],
                },
              ],
            },
          }
        : { outcome: 'not_actionable', message: 'no match' }
      return Promise.resolve({ result, rawContent: null, providerStatus: 200, finishReason: 'stop', error: null })
    },
    runAgentStream: () => new ReadableStream<string>({ start(c) { c.close() } }),
    model: 'fake',
    maxAttempts: 5,
    recordTrace: () => {},
  }
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/functions/v1/ai-session-harness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

Deno.test('Hebrew prompt yields a valid draft whose drill reuses the indexed slug', async () => {
  const deps = makeDeps()
  const res = await createHandler(deps)(
    makeRequest({
      prompt: HEBREW_PROMPT,
      seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: {
        poolLength: 25,
        distanceUnits: 'm',
        groupNames: [],
        equipmentOptions: [],
        recentSessions: [],
        availableDrills: AVAILABLE_DRILLS,
      },
    }),
  )
  const body = (await res.json()) as { outcome: string; draft: { drills: Array<{ sourceSlug?: string }> } }
  assertEquals(res.status, 200)
  assertEquals(body.outcome, 'draft')
  assertEquals(body.draft.drills[0].sourceSlug, 'single-arm-pull')
  assert(validateSessionDraft(body.draft).ok)
  assert(validateHarnessResult(body).ok)
})
