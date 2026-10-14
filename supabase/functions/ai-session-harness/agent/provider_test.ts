// Provider adapter: exercises every error branch with a stubbed fetch, so the
// network boundary is covered without any real provider or spend.

import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { callProvider, ProviderError, type ProviderConfig } from './provider.ts'
import { PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS } from './config.ts'
import type { SessionDraftRequest } from './contract.ts'

const request: SessionDraftRequest = {
  prompt: 'Plan a set',
  seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
  context: {
    poolLength: 25,
    distanceUnits: 'm',
    groupNames: [],
    equipmentOptions: [],
    recentSessions: [],
  },
}

const config: ProviderConfig = { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' }

function stubFetch(impl: typeof fetch): () => void {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return () => {
    globalThis.fetch = original
  }
}

Deno.test('callProvider rejects when the API key is missing', async () => {
  await assertRejects(
    () => callProvider(request, { ...config, apiKey: '' }),
    ProviderError,
    'provider API key is not configured',
  )
})

Deno.test('callProvider maps a non-2xx response to a status error', async () => {
  const restore = stubFetch(() => Promise.resolve(new Response('nope', { status: 500 })))
  try {
    await assertRejects(() => callProvider(request, config), ProviderError, 'provider returned 500')
  } finally {
    restore()
  }
})

async function captureProviderError(fn: () => Promise<unknown>): Promise<ProviderError> {
  try {
    await fn()
  } catch (err) {
    if (err instanceof ProviderError) return err
    throw err
  }
  throw new Error('expected callProvider to throw ProviderError')
}

Deno.test('callProvider maps an upstream 429 to rate_limited with its Retry-After hint', async () => {
  const restore = stubFetch(() => Promise.resolve(new Response('slow', { status: 429, headers: { 'Retry-After': '42' } })))
  try {
    const err = await captureProviderError(() => callProvider(request, config))
    assertEquals(err.kind, 'rate_limited')
    assertEquals(err.retryAfterSeconds, 42)
  } finally {
    restore()
  }
})

Deno.test('callProvider falls back to a default retry when the 429 has no Retry-After', async () => {
  const restore = stubFetch(() => Promise.resolve(new Response('slow', { status: 429 })))
  try {
    const err = await captureProviderError(() => callProvider(request, config))
    assertEquals(err.kind, 'rate_limited')
    assertEquals(err.retryAfterSeconds, PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS)
  } finally {
    restore()
  }
})

Deno.test('callProvider maps an upstream 503 to unavailable', async () => {
  const restore = stubFetch(() => Promise.resolve(new Response('down', { status: 503 })))
  try {
    const err = await captureProviderError(() => callProvider(request, config))
    assertEquals(err.kind, 'unavailable')
  } finally {
    restore()
  }
})

Deno.test('callProvider maps a missing message to a shape error', async () => {
  const restore = stubFetch(() =>
    Promise.resolve(
      new Response(JSON.stringify({ choices: [{}] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  try {
    await assertRejects(() => callProvider(request, config), ProviderError, 'provider response missing content')
  } finally {
    restore()
  }
})

Deno.test('callProvider returns the parsed structured result on success', async () => {
  const draft = { outcome: 'draft', draft: { schemaVersion: 1, session: { name: 'S' }, drills: [] } }
  const providerBody = { choices: [{ message: { content: JSON.stringify(draft) } }] }
  const restore = stubFetch(() =>
    Promise.resolve(
      new Response(JSON.stringify(providerBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  try {
    const result = await callProvider(request, config)
    assertEquals(result.outcome, 'draft')
  } finally {
    restore()
  }
})

Deno.test('callProvider times out a stalled request', async () => {
  const restore = stubFetch(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
  )
  try {
    await assertRejects(() => callProvider(request, config, 5), ProviderError, 'provider request timed out')
  } finally {
    restore()
  }
})

Deno.test('callProvider maps an unexpected fetch failure to a network error', async () => {
  const restore = stubFetch(() => Promise.reject(new TypeError('network down')))
  try {
    await assertRejects(() => callProvider(request, config), ProviderError, 'network down')
  } finally {
    restore()
  }
})
