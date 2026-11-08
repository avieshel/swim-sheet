// Tunable configuration for the admin coach-assist function. Every bound that a
// later task would otherwise inline as a magic number lives here.

import type { EnvGet, ScopedTable } from './types.ts'

const DEFAULT_ENV: EnvGet = (key) => Deno.env.get(key)

// Owner identities, configured as a comma-separated allowlist in the function's
// environment. Trimmed and de-duplicated; empty entries are dropped so a trailing
// comma or stray whitespace cannot silently grant access.
export function getOwnerAllowlist(env: EnvGet = DEFAULT_ENV): string[] {
  const raw = env('OWNER_USER_IDS')
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

// Whether the given authenticated user id is a configured owner.
export function isOwner(uid: string, env: EnvGet = DEFAULT_ENV): boolean {
  return getOwnerAllowlist(env).includes(uid)
}

// Tables the admin may write to on a coach's behalf. Placeholder for later
// tasks; imported (not re-declared) wherever the route table needs the scope.
export const ADMIN_WRITABLE_TABLES: readonly ScopedTable[] = [
  'sessions',
  'drills',
  'swimmers',
  'library_drills',
]

// Maximum number of rows an admin write may batch in a single request.
export const ADMIN_BATCH_CAP = 200
