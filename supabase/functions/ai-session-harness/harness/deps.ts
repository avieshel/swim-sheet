// Real dependency wiring for the harness. This is the only module that touches
// Supabase and the agent; index.ts composes it with the handler.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { callProvider, getProviderConfig } from '../agent/provider.ts'
import type { AuthOutcome, HandlerDeps, RateLimitInfo } from './handler.ts'

type EnvGet = (key: string) => string | undefined

export function createDeps(env: EnvGet = (key) => Deno.env.get(key)): HandlerDeps | null {
  const supabaseUrl = env('SUPABASE_URL')
  const supabaseAnonKey = env('SUPABASE_ANON_KEY')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseAnonKey || !serviceKey) return null

  // Service-role client for the private rate-limit store; never exposed.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async verifyUser(token: string): Promise<AuthOutcome> {
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

    runAgent: (request) => callProvider(request, getProviderConfig()),
  }
}
