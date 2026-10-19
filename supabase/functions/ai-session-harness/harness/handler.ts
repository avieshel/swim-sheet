// The harness: HTTP request handling for the session-draft agent.
//
// This module owns the transport/auth/rate-limit concerns and knows nothing about
// how the agent is implemented — every side effect is injected via `HandlerDeps`.
// That keeps the whole request lifecycle unit-testable with fakes (see
// handler_test.ts) and keeps the agent independently testable.

import { PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS } from '../agent/config.ts'
import { ProviderError, parseProviderJson } from '../agent/provider.ts'
import { buildSystemPrompt, buildUserContent } from '../agent/prompt.ts'
import { validateHarnessResult } from '../agent/output.ts'
import { debugLog } from '../agent/debug.ts'
import type { SessionDraftRequest } from '../agent/contract.ts'
import type { AiTraceRecord } from '../analytics/types.ts'
import { json, rateLimited, CORS_HEADERS } from './http.ts'
import { validateRequest } from './request.ts'

export interface RunAgentResult {
  result: unknown
  rawContent: string | null
  providerStatus?: number
  finishReason?: string
}

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
  runAgent(request: SessionDraftRequest): Promise<RunAgentResult>
  // Streaming variant. Returns a text stream of provider deltas; the handler
  // frames them as SSE and assembles the final validated draft on completion.
  // `signal` lets an upstream cancel (client disconnect) stop generation.
  runAgentStream(request: SessionDraftRequest, signal?: AbortSignal): ReadableStream<string>
  // Provider model in use (for tracing only).
  model: string
  // Fire-and-forget owner-only AI-analytics trace. Never blocks or throws.
  recordTrace(record: AiTraceRecord): void
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
function streamResponse(
  deps: HandlerDeps,
  request: SessionDraftRequest,
  base: { emit: (extra: Partial<AiTraceRecord>) => void },
  signal?: AbortSignal,
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = ''
      const providerCalledAt = new Date().toISOString()
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
          // Client disconnected while we were finishing; nothing to record.
          try {
            controller.close()
          } catch {
            /* already closed */
          }
          return
        }
        const parsed = parseProviderJson(full)
        if (parsed === undefined) {
          base.emit({
            raw_content: full || null,
            provider_called_at: providerCalledAt,
            streamed: true,
            parsed_outcome: null,
            error_kind: 'invalid',
            error_message: 'provider response was not valid JSON',
          })
          send({ type: 'error', outcome: 'invalid', message: 'provider response was not valid JSON' })
          controller.close()
          return
        }
        const validation = validateHarnessResult(parsed)
        if (!validation.ok) {
          base.emit({
            raw_content: full || null,
            provider_called_at: providerCalledAt,
            streamed: true,
            parsed_outcome: null,
            error_kind: 'invalid',
            error_message: validation.error.message,
          })
          send({ type: 'error', outcome: 'invalid', message: validation.error.message })
          controller.close()
          return
        }
        base.emit({
          raw_content: full || null,
          provider_called_at: providerCalledAt,
          streamed: true,
          parsed_outcome: validation.value.outcome,
          error_kind: 'none',
          error_message: null,
        })
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
        const kind = err instanceof ProviderError ? err.kind : 'network'
        base.emit({
          raw_content: full || null,
          provider_called_at: providerCalledAt,
          streamed: true,
          parsed_outcome: null,
          error_kind: kind,
          error_message: err instanceof Error ? err.message : null,
        })
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
    const startedAtWall = Date.now()
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
    const validated = request.value

    // Owner-only AI-analytics trace base. Finalized (elapsed/completed) by `emit`
    // on each outcome branch. Never blocks or throws into the request path.
    const traceBase: AiTraceRecord = {
      user_id: auth.userId,
      analytics_session_id: validated.analyticsSessionId ?? null,
      trace_id: validated.traceId ?? null,
      model: deps.model,
      system_prompt: buildSystemPrompt(validated.context),
      user_content: buildUserContent(validated),
      raw_content: null,
      provider_status: null,
      finish_reason: null,
      parsed_outcome: null,
      error_kind: null,
      error_message: null,
      elapsed_ms: 0,
      streamed: false,
      started_at: new Date(startedAtWall).toISOString(),
      provider_called_at: null,
      completed_at: new Date().toISOString(),
    }
    const emit = (extra: Partial<AiTraceRecord>): void => {
      deps.recordTrace({
        ...traceBase,
        ...extra,
        elapsed_ms: Math.round(performance.now() - startedAt),
        completed_at: new Date().toISOString(),
      })
    }

    // 3. Private per-user rate limit.
    const rate = await deps.recordRequest(auth.userId)
    if (!rate) {
      emit({ error_kind: 'rate_limit_unavailable' })
      return deny('rate-limit-unavailable', json({ error: 'rate_limit_unavailable' }, 503))
    }
    if (!rate.allowed) {
      emit({ error_kind: 'rate_limited' })
      return deny('rate-limited', rateLimited('rate_limited', rate.retry_after_seconds))
    }

    // 3.5. Streaming path. A caller that negotiates `text/event-stream` gets a
    // Server-Sent-Events stream: incremental `delta` frames for a live preview,
    // then a final `done` frame with the validated draft (or an `error` frame).
    // The default JSON path below is unchanged, so non-streaming callers (and
    // the eval pipeline) keep working.
    if (req.headers.get('accept')?.includes('text/event-stream')) {
      return streamResponse(deps, validated, { emit }, req.signal)
    }

    // 4. One structured-output agent call, validated before returning.
    let providerCalledAt: string | null = null
    try {
      providerCalledAt = new Date().toISOString()
      const agent = await deps.runAgent(validated)
      const validation = validateHarnessResult(agent.result)
      if (!validation.ok) {
        emit({
          raw_content: agent.rawContent,
          provider_status: agent.providerStatus ?? null,
          finish_reason: agent.finishReason ?? null,
          parsed_outcome: null,
          error_kind: 'invalid',
          error_message: validation.error.message,
          provider_called_at: providerCalledAt,
        })
        return deny('invalid-provider-response', json({ error: 'invalid_provider_response' }, 502))
      }
      emit({
        raw_content: agent.rawContent,
        provider_status: agent.providerStatus ?? null,
        finish_reason: agent.finishReason ?? null,
        parsed_outcome: validation.value.outcome,
        error_kind: 'none',
        error_message: null,
        provider_called_at: providerCalledAt,
      })
      return json(validation.value, 200)
    } catch (err) {
      const kind = err instanceof ProviderError ? err.kind : 'network'
      const message = err instanceof Error ? err.message : null
      emit({
        raw_content: null,
        provider_status: null,
        finish_reason: null,
        parsed_outcome: null,
        error_kind: kind,
        error_message: message,
        provider_called_at: providerCalledAt,
      })
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
