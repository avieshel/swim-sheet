// AI session harness Edge Function.
//
// Trust boundary: the browser never sees the provider key. This function
// verifies the caller's Supabase JWT (rejecting anonymous users), enforces a
// private per-user rate limit, makes one structured-output provider call, and
// validates the response before returning it. The client validates again.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { callProvider, getProviderConfig, ProviderError } from './provider.ts'
import { validateHarnessResult } from './output.ts'
import type { SessionDraftRequest } from './contract.ts'

const MAX_PROMPT_LENGTH = 4000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface RateLimitResult {
  allowed: boolean
  retry_after_seconds: number
}

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Authenticate the caller from their own JWT.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: 'misconfigured' }, 500)

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  if (userData.user.is_anonymous) return json({ error: 'anonymous_not_allowed' }, 401)
  const userId = userData.user.id

  // 2. Parse and lightly validate the request.
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  if (!isRequest(raw)) return json({ error: 'invalid_request' }, 400)
  if (raw.prompt.length > MAX_PROMPT_LENGTH) return json({ error: 'prompt_too_long' }, 400)

  const request = raw as SessionDraftRequest

  // 3. Per-user rate limit via the private store (service-role only).
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) return json({ error: 'misconfigured' }, 500)
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: rate, error: rateError } = await admin
    .rpc('ai_request_record', { p_user: userId })
    .single<RateLimitResult>()
  if (rateError || !rate) return json({ error: 'rate_limit_unavailable' }, 503)
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, rate.retry_after_seconds)),
      },
    })
  }

  // 4. One structured-output provider call.
  try {
    const result = await callProvider(request, getProviderConfig())
    const validation = validateHarnessResult(result)
    if (!validation.ok) return json({ error: 'invalid_provider_response' }, 502)
    return json(validation.value, 200)
  } catch (err) {
    if (err instanceof ProviderError && err.kind === 'timeout') {
      return json({ error: 'provider_timeout' }, 408)
    }
    return json({ error: 'provider_error' }, 502)
  }
})

function isRequest(value: unknown): value is { prompt: string } & Partial<SessionDraftRequest> {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (typeof obj.prompt !== 'string') return false
  if (obj.seed !== undefined && typeof obj.seed !== 'object') return false
  if (obj.context !== undefined && typeof obj.context !== 'object') return false
  return true
}
