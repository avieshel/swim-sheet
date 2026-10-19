// Provider adapter: exercises every error branch with a stubbed fetch, so the
// network boundary is covered without any real provider or spend.

import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { callProvider, callProviderStream, ProviderError, type ProviderConfig } from './provider.ts'
import { PROVIDER_MAX_ATTEMPTS, PROVIDER_MAX_TOKENS, PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS } from './config.ts'
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

const config: ProviderConfig = { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm', maxTokens: PROVIDER_MAX_TOKENS, maxAttempts: PROVIDER_MAX_ATTEMPTS }

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

Deno.test('callProvider sends a bounded max_tokens', async () => {
  let captured: { max_tokens?: number } | undefined
  const restore = stubFetch((_url, init) => {
    captured = JSON.parse(String(init?.body)) as { max_tokens?: number }
    return Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"outcome":"not_actionable","message":"hi"}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
  try {
    await callProvider(request, config)
    assertEquals(captured?.max_tokens, config.maxTokens)
  } finally {
    restore()
  }
})

Deno.test('callProvider recovers a fenced JSON block', async () => {
  const payload = { outcome: 'draft', draft: { schemaVersion: 1, session: { name: 'S' }, drills: [] } }
  const restore = stubFetch(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Here is the draft:\n```json\n' + JSON.stringify(payload) + '\n```' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  )
  try {
    const result = await callProvider(request, config)
    assertEquals(result.outcome, 'draft')
  } finally {
    restore()
  }
})

Deno.test('callProvider recovers JSON surrounded by prose', async () => {
  const payload = { outcome: 'not_actionable', message: 'Not a session.' }
  const restore = stubFetch(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Sure! ' + JSON.stringify(payload) + ' Hope that helps.' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  )
  try {
    const result = await callProvider(request, config)
    assertEquals(result.outcome, 'not_actionable')
  } finally {
    restore()
  }
})

Deno.test('callProvider rejects content that is not JSON at all', async () => {
  const restore = stubFetch(() =>
    Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { content: 'I cannot help with that.' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  try {
    await assertRejects(
      () => callProvider(request, config),
      ProviderError,
      'provider response was not valid JSON',
    )
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

// --- Streaming variant ---

async function readStringStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader()
  let out = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      out += value
    }
  } catch (err) {
    if (err instanceof ProviderError) return `ERROR:${err.kind}`
    throw err
  }
  return out
}

Deno.test('callProviderStream yields text deltas reconstructed from OpenAI-style SSE', async () => {
  const payload = { outcome: 'draft', draft: { schemaVersion: 1, session: { name: 'S' }, drills: [] } }
  const json = JSON.stringify(payload)
  const half = Math.floor(json.length / 2)
  const sse =
    `data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] })}\n\n` +
    `data: ${JSON.stringify({ choices: [{ delta: { content: json.slice(0, half) } }] })}\n\n` +
    `data: ${JSON.stringify({ choices: [{ delta: { content: json.slice(half) } }] })}\n\n` +
    `data: [DONE]\n\n`
  const restore = stubFetch(() => Promise.resolve(new Response(sse, { status: 200 })))
  try {
    const got = await readStringStream(callProviderStream(request, config))
    assertEquals(JSON.parse(got), payload)
  } finally {
    restore()
  }
})

Deno.test('callProviderStream requests a stream and bounded max_tokens', async () => {
  let captured: { stream?: boolean; max_tokens?: number } | undefined
  const restore = stubFetch((_url, init) => {
    captured = JSON.parse(String(init?.body)) as { stream?: boolean; max_tokens?: number }
    return Promise.resolve(
      new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"outcome":"not_actionable","message":"hi"}' } }] })}\n\n`, {
        status: 200,
      }),
    )
  })
  try {
    await readStringStream(callProviderStream(request, config))
    assertEquals(captured?.stream, true)
    assertEquals(captured?.max_tokens, config.maxTokens)
  } finally {
    restore()
  }
})

Deno.test('callProviderStream maps an upstream 429 to rate_limited', async () => {
  const restore = stubFetch(() => Promise.resolve(new Response('slow', { status: 429, headers: { 'Retry-After': '42' } })))
  try {
    const got = await readStringStream(callProviderStream(request, config))
    assertEquals(got, 'ERROR:rate_limited')
  } finally {
    restore()
  }
})

Deno.test('callProviderStream surfaces a missing-key error through the stream', async () => {
  const got = await readStringStream(callProviderStream(request, { ...config, apiKey: '' }))
  assertEquals(got, 'ERROR:network')
})
