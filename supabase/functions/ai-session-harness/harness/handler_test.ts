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

const OK_BODY = JSON.stringify({ prompt: 'Plan a set' })

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    verifyUser: () => Promise.resolve({ kind: 'authenticated', userId: 'u1' }),
    recordRequest: () => Promise.resolve({ allowed: true, retry_after_seconds: 0 }),
    runAgent: () => Promise.resolve({ outcome: 'draft', draft: validDraft }),
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
  const res = await call(makeDeps(), makeRequest(JSON.stringify({ prompt: 123 })))
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'invalid_request')
})

Deno.test('returns 400 when the prompt exceeds the configured cap', async () => {
  const res = await call(makeDeps(), makeRequest(JSON.stringify({ prompt: 'x'.repeat(4001) })))
  assertEquals(res.status, 400)
  assertEquals(res.body.error, 'prompt_too_long')
})

Deno.test('returns 503 when the rate-limit store is unavailable', async () => {
  const res = await call(makeDeps({ recordRequest: () => Promise.resolve(null) }), makeRequest(OK_BODY))
  assertEquals(res.status, 503)
  assertEquals(res.body.error, 'rate_limit_unavailable')
})

Deno.test('returns 429 with Retry-After when rate limited', async () => {
  const deps = makeDeps({ recordRequest: () => Promise.resolve({ allowed: false, retry_after_seconds: 7 }) })
  const res = await createHandler(deps)(makeRequest(OK_BODY))
  assertEquals(res.status, 429)
  assertEquals(res.headers.get('Retry-After'), '7')
  assertEquals(((await res.json()) as Record<string, unknown>).error, 'rate_limited')
})

Deno.test('returns the agent draft on success', async () => {
  const res = await call(makeDeps(), makeRequest(OK_BODY))
  assertEquals(res.status, 200)
  assertEquals(res.body.outcome, 'draft')
})

Deno.test('returns 502 when the agent output fails validation', async () => {
  const res = await call(makeDeps({ runAgent: () => Promise.resolve({ outcome: 'nope' }) }), makeRequest(OK_BODY))
  assertEquals(res.status, 502)
  assertEquals(res.body.error, 'invalid_provider_response')
})

Deno.test('returns 408 when the agent times out', async () => {
  const deps = makeDeps({ runAgent: () => Promise.reject(new ProviderError('timeout', 'slow')) })
  const res = await call(deps, makeRequest(OK_BODY))
  assertEquals(res.status, 408)
  assertEquals(res.body.error, 'provider_timeout')
})

Deno.test('returns 502 for other agent failures', async () => {
  const deps = makeDeps({ runAgent: () => Promise.reject(new ProviderError('status', 'boom')) })
  const res = await call(deps, makeRequest(OK_BODY))
  assertEquals(res.status, 502)
  assertEquals(res.body.error, 'provider_error')
})
