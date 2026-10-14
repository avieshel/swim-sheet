// The harness: HTTP request handling for the session-draft agent.
//
// This module owns the transport/auth/rate-limit concerns and knows nothing about
// how the agent is implemented — every side effect is injected via `HandlerDeps`.
// That keeps the whole request lifecycle unit-testable with fakes (see
// handler_test.ts) and keeps the agent independently testable.

import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config.ts'
import { PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS } from '../agent/config.ts'
import { ProviderError } from '../agent/provider.ts'
import { validateHarnessResult } from '../agent/output.ts'
import type { SessionDraftRequest } from '../agent/contract.ts'
import { json, rateLimited } from './http.ts'

export type AuthOutcome =
  | { kind: 'authenticated'; userId: string }
  | { kind: 'anonymous' }
  | { kind: 'unauthenticated' }

export interface RateLimitInfo {
  allowed: boolean
  retry_after_seconds: number
}

export interface HandlerDeps {
  // Resolve a caller JWT to an authenticated (non-anonymous) user.
  verifyUser(token: string): Promise<AuthOutcome>
  // Record the request and return the rate-limit decision, or null when the
  // rate-limit store is unavailable.
  recordRequest(userId: string): Promise<RateLimitInfo | null>
  // Run one structured-output agent call. The result is validated against the
  // shared contract before it is returned.
  runAgent(request: SessionDraftRequest): Promise<unknown>
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  return async function handle(req: Request): Promise<Response> {
    // 1. Authenticate the caller from their own JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'unauthorized' }, 401)

    const auth = await deps.verifyUser(token)
    if (auth.kind === 'unauthenticated') return json({ error: 'unauthorized' }, 401)
    if (auth.kind === 'anonymous') return json({ error: 'anonymous_not_allowed' }, 401)

    // 2. Parse and lightly validate the request.
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return json({ error: 'invalid_json' }, 400)
    }
    if (!isRequest(raw)) return json({ error: 'invalid_request' }, 400)
    if (raw.prompt.length > defaultSessionDraftConfig.limits.maxPromptLength) {
      return json({ error: 'prompt_too_long' }, 400)
    }
    const request = raw as SessionDraftRequest

    // 3. Private per-user rate limit.
    const rate = await deps.recordRequest(auth.userId)
    if (!rate) return json({ error: 'rate_limit_unavailable' }, 503)
    if (!rate.allowed) {
      return rateLimited('rate_limited', rate.retry_after_seconds)
    }

    // 4. One structured-output agent call, validated before returning.
    try {
      const result = await deps.runAgent(request)
      const validation = validateHarnessResult(result)
      if (!validation.ok) return json({ error: 'invalid_provider_response' }, 502)
      return json(validation.value, 200)
    } catch (err) {
      if (err instanceof ProviderError) {
        if (err.kind === 'timeout') return json({ error: 'provider_timeout' }, 408)
        if (err.kind === 'rate_limited') {
          return rateLimited('provider_rate_limited', err.retryAfterSeconds ?? PROVIDER_RATE_LIMIT_FALLBACK_RETRY_SECONDS)
        }
        if (err.kind === 'unavailable') return json({ error: 'provider_unavailable' }, 503)
      }
      return json({ error: 'provider_error' }, 502)
    }
  }
}

export function isRequest(value: unknown): value is { prompt: string } & Partial<SessionDraftRequest> {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (typeof obj.prompt !== 'string') return false
  if (obj.seed !== undefined && typeof obj.seed !== 'object') return false
  if (obj.context !== undefined && typeof obj.context !== 'object') return false
  return true
}
