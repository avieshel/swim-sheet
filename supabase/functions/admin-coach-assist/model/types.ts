// Domain types for the admin coach-assist Edge Function. Shared by the handler
// route table (added incrementally across tasks) and the service-layer deps.

// A minimal environment-getter abstraction so config/deps stay injectable and
// testable without touching Deno.env directly.
export type EnvGet = (key: string) => string | undefined

// Tables a coach may write to on behalf of an owner. The allowlist is the
// single source of truth for which scopes an admin action may target; later
// tasks extend the route table to consume it.
export type ScopedTable = 'sessions' | 'drills' | 'swimmers' | 'library_drills'

// A coach (non-owner) whose tenant the owner is assisting.
export interface CoachSummary {
  userId: string
  name: string
  email: string
  orgId: string
}

// A single owner-scoped write the admin performs against a coach's tenant.
export interface ScopedWrite {
  orgId: string
  table: ScopedTable
  coachUserId: string
  payload: Record<string, unknown>
}

export type SessionBundleResult =
  | { outcome: 'created'; sessionId: string; drillIds: string[] }
  | { outcome: 'name_conflict' }
