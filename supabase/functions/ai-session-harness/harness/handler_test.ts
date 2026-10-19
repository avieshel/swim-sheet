// Harness request lifecycle, exercised end-to-end with fake dependencies.
// Covers the auth, validation, rate-limit, and provider-error branches that
// previously required a live Supabase project and provider.

import { assertEquals } from 'jsr:@std/assert@1'
import { createHandler, type HandlerDeps } from './handler.ts'
import { ProviderError } from '../agent/provider.ts'

const validDraft = {
  schemaVersion: 1,
  session: { name: 'Tuesday Endurance' },
  drills: [
    { name: 'Warmup', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 2 }] },
  ],
}

const VALID_REQUEST = {
  prompt: 'Plan a set',
  seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
  context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: [], recentSessions: [] },
}

const OK_BODY = JSON.stringify(VALID_REQUEST)

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  const emptyStream = () => new ReadableStream<string>({ start(c) { c.close() } })
  return {
    verifyUser: () => Promise.resolve({ kind: 'authenticated', userId: 'u1' }),
    recordRequest: () => Promise.resolve({ allowed: true, retry_after_seconds: 0 }),
    runAgent: () =>
      Promise.resolve({ result: { outcome: 'draft', draft: validDraft }, rawContent: null, providerStatus: 200, finishReason: 'stop', error: null }),
    runAgentStream: emptyStream,
    model: 'gpt-4o-mini',
    maxAttempts: 5,
    recordTrace: () => {},
    ...overrides,
  }
}

function makeRequest(body: string, headers: Record<string, string> = { Authorization: 'Bearer token' }): Request {
  return new Request('http://localhost/functions/v1/ai-session-harness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

async function call(deps: HandlerDeps, req: Request): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await createHandler(deps)(req)
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

Deno.test('returns 401 when the bearer token is missing', async () => {
  const res = await call(makeDeps(), makeRequest(OK_BODY, {}))
  assertEquals(res.status, 401)
  assertEquals(res.body.error, 'unauthorized')
})

Deno.test('returns 401 when the token does not resolve to a user', async () => {
  const res = await call(makeDeps({ verifyUser: () => Promise.resolve({ kind: 'unauthenticated' }) }), makeRequest(OK_BODY))
  assertEquals(res.status, 401)
  assertEquals(res.body.error, 'unauthorized')
})

Deno.test('returns 401 for an anonymous user', async () => {
  const res = await call(makeDeps({ verifyUser: () => Promise.resolve({ kind: 'anonymous' }) }), makeRequest(OK_BODY))
  assertEquals(res.status, 401)
  assertEquals(res.body.error, 'anonymous_not_allowed')
})

Deno.test('returns 400 for a non-JSON body', async () => {
  const res = await call(makeDeps(), makeRequest('not json'))
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'invalid_json')
})

Deno.test('returns 400 when the prompt is not a string', async () => {
  const res = await call(makeDeps(), makeRequest(JSON.stringify({ ...VALID_REQUEST, prompt: 123 })))
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'invalid_request')
})

Deno.test('returns 400 when the prompt exceeds the configured cap', async () => {
  const res = await call(makeDeps(), makeRequest(JSON.stringify({ ...VALID_REQUEST, prompt: 'x'.repeat(4001) })))
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'prompt_too_long')
})

Deno.test('returns 400 when the context is malformed', async () => {
  const res = await call(
    makeDeps(),
    makeRequest(
      JSON.stringify({ ...VALID_REQUEST, context: { ...VALID_REQUEST.context, equipmentOptions: ['monofin'] } }),
    ),
  )
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'invalid_request')
})

Deno.test('returns 400 when the seed is missing', async () => {
  const res = await call(
    makeDeps(),
    makeRequest(JSON.stringify({ prompt: 'A set', context: VALID_REQUEST.context })),
  )
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'invalid_request')
})

Deno.test('returns 503 when the rate-limit store is unavailable', async () => {
  const res = await call(makeDeps({ recordRequest: () => Promise.resolve(null) }), makeRequest(OK_BODY))
  assertEquals(res.status, 503)
  assertEquals(res.body.error, 'rate_limit_unavailable')
})

Deno.test('returns 429 with Retry-After and echoed seconds when rate limited', async () => {
  const deps = makeDeps({ recordRequest: () => Promise.resolve({ allowed: false, retry_after_seconds: 7 }) })
  const res = await createHandler(deps)(makeRequest(OK_BODY))
  assertEquals(res.status, 429)
  assertEquals(res.headers.get('Retry-After'), '7')
  assertEquals(await res.json(), { error: 'rate_limited', retry_after_seconds: 7 })
})

Deno.test('returns the agent draft on success', async () => {
  const res = await call(makeDeps(), makeRequest(OK_BODY))
  assertEquals(res.status, 200)
  assertEquals(res.body.outcome, 'draft')
})

Deno.test('returns 502 when the agent output fails validation', async () => {
  const res = await call(
    makeDeps({ runAgent: () => Promise.resolve({ result: { outcome: 'nope' }, rawContent: null, providerStatus: 200, finishReason: 'stop', error: null }) }),
    makeRequest(OK_BODY),
  )
  assertEquals(res.status, 502)
  assertEquals(res.body.error, 'invalid_provider_response')
})

Deno.test('returns 408 when the agent times out', async () => {
  const deps = makeDeps({ runAgent: () => Promise.resolve({ result: null, rawContent: null, error: { kind: 'timeout', message: 'slow' } }) })
  const res = await call(deps, makeRequest(OK_BODY))
  assertEquals(res.status, 408)
  assertEquals(res.body.error, 'provider_timeout')
})

Deno.test('returns 429 with the provider retry hint when the upstream rate-limits', async () => {
  const deps = makeDeps({ runAgent: () => Promise.resolve({ result: null, rawContent: null, error: { kind: 'rate_limited', message: 'slow', retryAfterSeconds: 33 } }) })
  const res = await createHandler(deps)(makeRequest(OK_BODY))
  assertEquals(res.status, 429)
  assertEquals(res.headers.get('Retry-After'), '33')
  assertEquals(await res.json(), { error: 'provider_rate_limited', retry_after_seconds: 33 })
})

Deno.test('returns 503 when the provider is unavailable', async () => {
  const deps = makeDeps({ runAgent: () => Promise.resolve({ result: null, rawContent: null, error: { kind: 'unavailable', message: 'down' } }) })
  const res = await call(deps, makeRequest(OK_BODY))
  assertEquals(res.status, 503)
  assertEquals(res.body.error, 'provider_unavailable')
})

Deno.test('returns 502 for other agent failures', async () => {
  const deps = makeDeps({ runAgent: () => Promise.resolve({ result: null, rawContent: null, error: { kind: 'status', message: 'boom' } }) })
  const res = await call(deps, makeRequest(OK_BODY))
  assertEquals(res.status, 502)
  assertEquals(res.body.error, 'provider_error')
})

// --- Streaming (SSE) path ---

async function readFrames(res: Response): Promise<Array<Record<string, unknown>>> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const frames: Array<Record<string, unknown>> = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 2)
      const line = block.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      frames.push(JSON.parse(line.slice(5).trim()))
    }
  }
  return frames
}

function streamRequest(body: string): Request {
  return new Request('http://localhost/functions/v1/ai-session-harness', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
      Accept: 'text/event-stream',
    },
    body,
  })
}

function deltaStream(parts: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const p of parts) controller.enqueue(p)
      controller.close()
    },
  })
}

Deno.test('streams delta frames then a done frame with the validated draft', async () => {
  const draft = { outcome: 'draft', draft: validDraft }
  const deps = makeDeps({ runAgentStream: () => deltaStream(['{"outcome":"draft","d', 'raft":', JSON.stringify(validDraft), '}']) })
  const res = await createHandler(deps)(streamRequest(OK_BODY))
  assertEquals(res.status, 200)
  assertEquals(res.headers.get('Content-Type'), 'text/event-stream')
  assertEquals(res.headers.get('access-control-allow-origin'), '*')
  const frames = await readFrames(res)
  const types = frames.map((f) => f.type)
  assertEquals(types[0], 'delta')
  assertEquals(types[types.length - 1], 'done')
  const done = frames[frames.length - 1] as { result: Record<string, unknown> }
  assertEquals(done.result.outcome, 'draft')
  const joined = frames.filter((f) => f.type === 'delta').map((f) => (f as { text: string }).text).join('')
  assertEquals(JSON.parse(joined), draft)
})

Deno.test('emits an error frame when the streamed text is not valid JSON', async () => {
  const deps = makeDeps({ runAgentStream: () => deltaStream(['this is not json']) })
  const res = await createHandler(deps)(streamRequest(OK_BODY))
  assertEquals(res.status, 200)
  const frames = await readFrames(res)
  const last = frames[frames.length - 1] as { type: string; outcome: string }
  assertEquals(last.type, 'error')
  assertEquals(last.outcome, 'invalid')
})

Deno.test('emits an error frame carrying the provider outcome on stream failure', async () => {
  const deps = makeDeps({
    runAgentStream: () =>
      new ReadableStream<string>({
        start(controller) {
          controller.error(new ProviderError('unavailable', 'down'))
        },
      }),
  })
  const res = await createHandler(deps)(streamRequest(OK_BODY))
  assertEquals(res.status, 200)
  const frames = await readFrames(res)
  const last = frames[frames.length - 1] as { type: string; outcome: string }
  assertEquals(last.type, 'error')
  assertEquals(last.outcome, 'provider')
})

Deno.test('does not stream without the text/event-stream Accept header', async () => {
  const deps = makeDeps({ runAgentStream: () => deltaStream(['ignored']) })
  const res = await call(deps, makeRequest(OK_BODY))
  assertEquals(res.status, 200)
  assertEquals(res.body.outcome, 'draft')
})

// --- AI-analytics trace ---

Deno.test('records a trace on success with the parsed outcome', async () => {
  const traces: Array<Record<string, unknown>> = []
  const deps = makeDeps({
    recordTrace: (record) => {
      traces.push(record as unknown as Record<string, unknown>)
    },
  })
  await call(deps, makeRequest(OK_BODY))
  assertEquals(traces.length, 1)
  assertEquals(traces[0].parsed_outcome, 'draft')
  assertEquals(traces[0].error_kind, 'none')
  assertEquals(traces[0].raw_content, null)
  assertEquals(traces[0].streamed, false)
})

Deno.test('records a trace on timeout', async () => {
  const traces: Array<Record<string, unknown>> = []
  const deps = makeDeps({
    runAgent: () => Promise.resolve({ result: null, rawContent: null, error: { kind: 'timeout', message: 'slow' } }),
    recordTrace: (record) => {
      traces.push(record as unknown as Record<string, unknown>)
    },
  })
  await call(deps, makeRequest(OK_BODY))
  assertEquals(traces.length, 1)
  assertEquals(traces[0].error_kind, 'timeout')
  assertEquals(traces[0].parsed_outcome, null)
})

Deno.test('records a trace on client rate-limit denial', async () => {
  const traces: Array<Record<string, unknown>> = []
  const deps = makeDeps({
    recordRequest: () => Promise.resolve({ allowed: false, retry_after_seconds: 7 }),
    recordTrace: (record) => {
      traces.push(record as unknown as Record<string, unknown>)
    },
  })
  await call(deps, makeRequest(OK_BODY))
  assertEquals(traces.length, 1)
  assertEquals(traces[0].error_kind, 'rate_limited')
})

// --- Retry loop ---

Deno.test('retries validation failures up to the cap then succeeds', async () => {
  let calls = 0
  const traces: Array<Record<string, unknown>> = []
  const deps = makeDeps({
    runAgent: () => {
      calls++
      if (calls < 3) {
        return Promise.resolve({ result: { outcome: 'nope' }, rawContent: `bad-${calls}`, providerStatus: 200, finishReason: 'stop', error: null })
      }
      return Promise.resolve({ result: { outcome: 'draft', draft: validDraft }, rawContent: 'good', providerStatus: 200, finishReason: 'stop', error: null })
    },
    recordTrace: (record) => {
      traces.push(record as unknown as Record<string, unknown>)
    },
  })
  const res = await call(deps, makeRequest(OK_BODY))
  assertEquals(res.status, 200)
  assertEquals(res.body.outcome, 'draft')
  assertEquals(calls, 3)
  // One trace row per attempt: two validation failures, then the success.
  assertEquals(traces.length, 3)
  assertEquals(traces[0].error_kind, 'invalid')
  assertEquals(traces[0].attempt_count, 1)
  assertEquals(traces[1].error_kind, 'invalid')
  assertEquals(traces[1].attempt_count, 2)
  const success = traces[2]
  assertEquals(success.attempt_count, 3)
  assertEquals(success.parsed_outcome, 'draft')
})

Deno.test('gives up after maxAttempts validation failures', async () => {
  let calls = 0
  const traces: Array<Record<string, unknown>> = []
  const deps = makeDeps({
    runAgent: () => {
      calls++
      return Promise.resolve({ result: { outcome: 'nope' }, rawContent: `bad-${calls}`, providerStatus: 200, finishReason: 'stop', error: null })
    },
    recordTrace: (record) => {
      traces.push(record as unknown as Record<string, unknown>)
    },
  })
  const res = await call(deps, makeRequest(OK_BODY))
  assertEquals(res.status, 502)
  assertEquals(res.body.error, 'invalid_provider_response')
  assertEquals(calls, 5)
  // One trace row per attempt (each a validation failure), sharing trace_id.
  assertEquals(traces.length, 5)
  const last = traces[4]
  assertEquals(last.attempt_count, 5)
  assertEquals(last.error_kind, 'invalid')
  assertEquals(last.raw_content, 'bad-5')
})

Deno.test('records the raw provider response on a contract validation failure', async () => {
  const traces: Array<Record<string, unknown>> = []
  const deps = makeDeps({
    runAgent: () =>
      Promise.resolve({ result: { outcome: 'nope' }, rawContent: '{"outcome":"draft","draft":{"bad":true}}', providerStatus: 200, finishReason: 'stop', error: null }),
    recordTrace: (record) => {
      traces.push(record as unknown as Record<string, unknown>)
    },
  })
  await call(deps, makeRequest(OK_BODY))
  // The handler retries contract validation failures up to maxAttempts, so each
  // attempt is its own trace row (sharing trace_id). The last one carries the
  // raw provider response that failed validation.
  assertEquals(traces.length, 5)
  const last = traces[4]
  assertEquals(last.raw_content, '{"outcome":"draft","draft":{"bad":true}}')
  assertEquals(last.error_kind, 'invalid')
})

Deno.test('retries invalid-JSON failures and records the last raw response', async () => {
  let calls = 0
  const traces: Array<Record<string, unknown>> = []
  const deps = makeDeps({
    runAgent: () => {
      calls++
      return Promise.resolve({ result: null, rawContent: `garbage-${calls}`, error: { kind: 'shape', message: 'provider response was not valid JSON' } })
    },
    recordTrace: (record) => {
      traces.push(record as unknown as Record<string, unknown>)
    },
  })
  const res = await call(deps, makeRequest(OK_BODY))
  assertEquals(res.status, 502)
  assertEquals(calls, 5)
  // One trace row per invalid-JSON attempt, sharing trace_id.
  assertEquals(traces.length, 5)
  const last = traces[4]
  assertEquals(last.error_kind, 'shape')
  assertEquals(last.raw_content, 'garbage-5')
  assertEquals(last.attempt_count, 5)
})

