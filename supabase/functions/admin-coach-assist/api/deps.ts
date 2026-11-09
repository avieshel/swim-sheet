// Real dependency wiring for the admin coach-assist function. This is the only
// module that touches Supabase and the environment; index.ts composes it with
// the handler. Everything that performs a side effect is injectable so the
// handler stays unit-testable with fakes (see api/handler_test.ts).

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { getOwnerAllowlist, isOwner } from '../model/config.ts'
import type { EnvGet } from '../model/types.ts'

const DEFAULT_ENV: EnvGet = (key) => Deno.env.get(key)

// Re-exported so callers can read the owner allowlist from a single import
// surface, regardless of whether they live under api/ or model/.
export { getOwnerAllowlist, isOwner }

// The service-role client is never exposed to the caller. Its concrete shape is
// the Supabase client; later tasks use it to write on a coach's behalf.
export type ServiceRoleClient = SupabaseClient

// Build the service-role client from the function environment. Callers must not
// receive this key; we only construct it behind this injected factory.
export function createServiceRoleClient(env: EnvGet = DEFAULT_ENV): ServiceRoleClient {
  const url = env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  return createClient(url, key, { auth: { persistSession: false } })
}

// Resolve the caller's authenticated user id from their JWT bearer token,
// mirroring the ai-session-harness auth pattern (anon-key getUser on the token).
// Returns null when the token is absent, malformed, or fails to resolve to a
// user — the handler treats null as "not an owner".
export async function getCallerUid(req: Request, env: EnvGet = DEFAULT_ENV): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const url = env('SUPABASE_URL')
  const anonKey = env('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return null
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

// The injectable surface the handler depends on.
export interface HandlerDeps {
  getCallerUid(req: Request): Promise<string | null>
  isOwner(uid: string): boolean
  createServiceRoleClient(): ServiceRoleClient
}

// Compose the real deps from the environment. The handler never reads env or
// constructs a client directly — it only calls through this object.
export function createDeps(env: EnvGet = DEFAULT_ENV): HandlerDeps {
  return {
    getCallerUid: (req) => getCallerUid(req, env),
    isOwner: (uid) => isOwner(uid, env),
    createServiceRoleClient: () => createServiceRoleClient(env),
  }
}
