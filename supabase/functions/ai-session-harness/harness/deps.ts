// Real dependency wiring for the harness. This is the only module that touches
// Supabase and the agent; index.ts composes it with the handler.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { ProviderError, callProvider, callProviderStream, getProviderConfig, type PriorAttempt, type ProviderMeta } from '../agent/provider.ts'
import { createTraceEmitter } from '../analytics/emitter.ts'
import type { AiTraceRecord } from '../analytics/types.ts'
import type { AuthOutcome, HandlerDeps, RateLimitInfo } from './handler.ts'

type EnvGet = (key: string) => string | undefined

export function createDeps(env: EnvGet = (key) => Deno.env.get(key)): HandlerDeps | null {
  const supabaseUrl = env('SUPABASE_URL')
  const supabaseAnonKey = env('SUPABASE_ANON_KEY')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseAnonKey || !serviceKey) return null

  // Service-role client for the private rate-limit store and the AI-analytics
  // trace; never exposed.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  async function insertTrace(row: AiTraceRecord): Promise<void> {
    const { error } = await admin.rpc('ai_analytics_trace_insert', {
      p_user_id: row.user_id,
      p_session_id: row.session_id,
      p_trace_id: row.trace_id,
      p_model: row.model,
      p_system_prompt: row.system_prompt,
      p_user_content: row.user_content,
      p_raw_content: row.raw_content,
      p_provider_status: row.provider_status,
      p_finish_reason: row.finish_reason,
      p_parsed_outcome: row.parsed_outcome,
      p_error_kind: row.error_kind,
      p_error_message: row.error_message,
      p_attempt_count: row.attempt_count,
      p_elapsed_ms: row.elapsed_ms,
      p_streamed: row.streamed,
      p_started_at: row.started_at,
      p_provider_called_at: row.provider_called_at,
      p_completed_at: row.completed_at,
    })
    if (error) {
      // A trace-write failure must not break the AI path (the emitter swallows
      // the rejection), but it should not be invisible either: a missing
      // function, a grant/permission regression, or a column mismatch all show
      // up here. Log to the function's error log with only non-sensitive
      // identifiers — never prompt or raw model content.
      console.error('[ai-harness] trace insert failed', {
        code: error.code,
        message: error.message,
        user_id: row.user_id,
        trace_id: row.trace_id,
        session_id: row.session_id,
      })
      throw error
    }
  }

  // Keep the trace write alive after the response is sent, without blocking it.
  // `EdgeRuntime.waitUntil` is provided by the Supabase Edge Functions runtime.
  function schedule(task: Promise<void>): void {
    const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
    rt?.waitUntil?.(task)
  }

  const emitter = createTraceEmitter({ insertTrace, schedule })

  return {
    async verifyUser(input: { token: string; gatewayUserId?: string | null }): Promise<AuthOutcome> {
      // With verify_jwt enabled, the Supabase gateway has already authenticated
      // the caller and injects x-user-id into the request. Trusting that is
      // equivalent to the gateway check and avoids re-reading an Authorization
      // header the gateway may strip. Falls back to a direct token check.
      if (input.gatewayUserId) {
        return { kind: 'authenticated', userId: input.gatewayUserId }
      }
      const token = input.token
      if (!token) return { kind: 'unauthenticated' }
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
      const { data, error } = await userClient.auth.getUser(token)
      if (error || !data.user) return { kind: 'unauthenticated' }
      if (data.user.is_anonymous) return { kind: 'anonymous' }
      return { kind: 'authenticated', userId: data.user.id }
    },

    async recordRequest(userId: string): Promise<RateLimitInfo | null> {
      const { data, error } = await admin
        .rpc('ai_request_record', { p_user: userId })
        .single<RateLimitInfo>()
      if (error || !data) return null
      return data
    },

    runAgent: async (request, priorAttempt?: PriorAttempt) => {
      let meta: ProviderMeta = { rawContent: null }
      try {
        const result = await callProvider(
          request,
          getProviderConfig(),
          undefined,
          (m) => {
            meta = m
          },
          priorAttempt,
        )
        return {
          result,
          rawContent: meta.rawContent,
          providerStatus: meta.providerStatus,
          finishReason: meta.finishReason,
          error: null,
        }
      } catch (err) {
        if (err instanceof ProviderError) {
          return {
            result: null,
            rawContent: meta.rawContent,
            providerStatus: err.status,
            finishReason: meta.finishReason,
            error: { kind: err.kind, message: err.message, retryAfterSeconds: err.retryAfterSeconds },
          }
        }
        return {
          result: null,
          rawContent: meta.rawContent,
          providerStatus: meta.providerStatus,
          finishReason: meta.finishReason,
          error: { kind: 'network', message: err instanceof Error ? err.message : 'network error' },
        }
      }
    },

    runAgentStream: (request, signal, priorAttempt?, onMeta?) =>
      callProviderStream(request, getProviderConfig(), signal, priorAttempt, onMeta),

    model: getProviderConfig().model,

    maxAttempts: getProviderConfig().maxAttempts,

    recordTrace: (record) => emitter.record(record),
  }
}
