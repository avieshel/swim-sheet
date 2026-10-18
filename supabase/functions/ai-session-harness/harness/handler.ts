// The harness: HTTP request handling for the session-draft agent.
//
// This module owns the transport/auth/rate-limit concerns and knows nothing about
// how the agent is implemented — every side effect is injected via `HandlerDeps`.
// That keeps the whole request lifecycle unit-testable with fakes (see
// handler_test.ts) and keeps the agent independently testable.

import { PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS } from '../agent/config.ts'
import { ProviderError, parseProviderJson } from '../agent/provider.ts'
import { validateHarnessResult } from '../agent/output.ts'
import { debugLog } from '../agent/debug.ts'
import type { SessionDraftRequest } from '../agent/contract.ts'
import { json, rateLimited, CORS_HEADERS } from './http.ts'
import { validateRequest } from './request.ts'

export type AuthOutcome =
  | { kind: 'authenticated'; userId: string }
  | { kind: 'anonymous' }
  | { kind: 'unauthenticated' }

export interface RateLimitInfo {
  allowed: boolean
  retry_after_seconds: number
}

export interface HandlerDeps {
  // Resolve a caller JWT to an authenticated (non-anonymous) user. The gateway
  // (verify_jwt) injects x-user-id; pass it to skip re-reading a header the
  // gateway may strip.
  verifyUser(input: { token: string; gatewayUserId?: string | null }): Promise<AuthOutcome>
  // Record the request and return the rate-limit decision, or null when the
  // rate-limit store is unavailable.
  recordRequest(userId: string): Promise<RateLimitInfo | null>
  // Run one structured-output agent call. The result is validated against the
  // shared contract before it is returned.
  runAgent(request: SessionDraftRequest): Promise<unknown>
  // Streaming variant. Returns a text stream of provider deltas; the handler
  // frames them as SSE and assembles the final validated draft on completion.
  // `signal` lets an upstream cancel (client disconnect) stop generation.
  runAgentStream(request: SessionDraftRequest, signal?: AbortSignal): ReadableStream<string>
}

// Map a provider failure to the client-facing outcome name used by the PWA's
// result handler, so the SSE error frame and the JSON error body stay aligned.
function providerErrorOutcome(err: ProviderError): { outcome: string; retryAfterSeconds?: number; message?: string } {
  switch (err.kind) {
    case 'timeout':
      return { outcome: 'timeout' }
    case 'rate_limited':
      return { outcome: 'provider_rate_limited', retryAfterSeconds: err.retryAfterSeconds ?? PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS }
    case 'unavailable':
      return { outcome: 'provider' }
    case 'status':
      return { outcome: 'provider' }
    case 'network':
      return { outcome: 'network' }
    case 'shape':
      return { outcome: 'invalid' }
    default:
      return { outcome: 'provider' }
  }
}

// Build the SSE response. Streams provider deltas as `data: {"type":"delta",...}`
// frames, then assembles the full text, validates it against the shared
// contract, and emits a single `done` or `error` frame before closing.
function streamResponse(deps: HandlerDeps, request: SessionDraftRequest, signal?: AbortSignal): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = ''
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }
      try {
        const deltas = deps.runAgentStream(request, signal)
        const reader = deltas.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          full += value
          send({ type: 'delta', text: value })
        }
        if (signal?.aborted) {
          // Client disconnected while we were finishing; nothing to send.
          try {
            controller.close()
          } catch {
            /* already closed */
          }
          return
        }
        const parsed = parseProviderJson(full)
        if (parsed === undefined) {
          send({ type: 'error', outcome: 'invalid', message: 'provider response was not valid JSON' })
          controller.close()
          return
        }
        const validation = validateHarnessResult(parsed)
        if (!validation.ok) {
          send({ type: 'error', outcome: 'invalid', message: validation.error.message })
          controller.close()
          return
        }
        send({ type: 'done', result: validation.value })
        controller.close()
      } catch (err) {
        if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          try {
            controller.close()
          } catch {
            /* already closed */
          }
          return
        }
        const mapped = err instanceof ProviderError ? providerErrorOutcome(err) : { outcome: 'network' }
        send({ type: 'error', ...mapped })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...CORS_HEADERS,
    },
  })
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  return async function handle(req: Request): Promise<Response> {
    // Every early return below logs which stage rejected the request, so a
    // failure is attributable without reading the code. Opt-in only: the
    // request log never carries the coach's prompt text (that stays in
    // agent/provider.ts, behind the same flag).
    const startedAt = performance.now()
    const deny = (stage: string, response: Response): Response => {
      debugLog('harness.denied', { stage, status: response.status, elapsedMs: Math.round(performance.now() - startedAt) })
      return response
    }
    // 1. Authenticate the caller from their own JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const gatewayUserId = req.headers.get('x-user-id')
    if (!token && !gatewayUserId) return deny('missing-token', json({ error: 'unauthorized' }, 401))

    const auth = await deps.verifyUser({ token, gatewayUserId })
    if (auth.kind === 'unauthenticated') return deny('unauthenticated', json({ error: 'unauthorized' }, 401))
    if (auth.kind === 'anonymous') return deny('anonymous', json({ error: 'anonymous_not_allowed' }, 401))

    // 2. Parse and validate the request at the trust boundary. The prompt,
    //    seed, and structural context are all bounded by the shared config.
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return deny('invalid-json', json({ error: 'invalid_json' }, 400))
    }
    const request = validateRequest(raw)
    if (!request.ok) {
      return deny(request.reason, json({ error: request.reason === 'prompt_too_long' ? 'prompt_too_long' : 'invalid_request' }, 400))
    }

    // 3. Private per-user rate limit.
    const rate = await deps.recordRequest(auth.userId)
    if (!rate) return deny('rate-limit-unavailable', json({ error: 'rate_limit_unavailable' }, 503))
    if (!rate.allowed) {
      return deny('rate-limited', rateLimited('rate_limited', rate.retry_after_seconds))
    }

    // 3.5. Streaming path. A caller that negotiates `text/event-stream` gets a
    // Server-Sent-Events stream: incremental `delta` frames for a live preview,
    // then a final `done` frame with the validated draft (or an `error` frame).
    // The default JSON path below is unchanged, so non-streaming callers (and
    // the eval pipeline) keep working.
    if (req.headers.get('accept')?.includes('text/event-stream')) {
      return streamResponse(deps, request.value, req.signal)
    }

    // 4. One structured-output agent call, validated before returning.
    try {
      const result = await deps.runAgent(request.value)
      const validation = validateHarnessResult(result)
      if (!validation.ok) {
        debugLog('harness.rejected', {
          reason: validation.error.code,
          detail: validation.error.message,
          elapsedMs: Math.round(performance.now() - startedAt),
        })
        return deny('invalid-provider-response', json({ error: 'invalid_provider_response' }, 502))
      }
      debugLog('harness.completed', {
        outcome: validation.value.outcome,
        elapsedMs: Math.round(performance.now() - startedAt),
      })
      return json(validation.value, 200)
    } catch (err) {
      if (err instanceof ProviderError) {
        if (err.kind === 'timeout') return deny('provider-timeout', json({ error: 'provider_timeout' }, 408))
        if (err.kind === 'rate_limited') {
          return deny('provider-rate-limited', rateLimited('provider_rate_limited', err.retryAfterSeconds ?? PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS))
        }
        if (err.kind === 'unavailable') return deny('provider-unavailable', json({ error: 'provider_unavailable' }, 503))
      }
      return deny('provider-error', json({ error: 'provider_error' }, 502))
    }
  }
}
