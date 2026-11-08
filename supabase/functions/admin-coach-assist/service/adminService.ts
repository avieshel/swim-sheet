// Coach resolution + listing for the admin coach-assist function.
//
// Every side effect (the DB read) is performed through a Supabase client that
// the caller passes in — the service never constructs a client itself. That
// keeps it unit-testable with a fake client (see adminService_test.ts) and lets
// the handler inject the service-role client behind the owner gate.

import type { ServiceRoleClient } from '../api/deps.ts'
import { ADMIN_BATCH_CAP } from '../model/config.ts'
import type { CoachSummary } from '../model/types.ts'

// Thrown when a coach cannot be mapped to exactly one personal organization:
// either they own none, or the data is ambiguous (more than one).
export class CoachResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoachResolutionError'
  }
}

interface OrgIdRow {
  id: string
}

interface OrgOwnerRow {
  id: string
  created_by: string
  profiles: { id: string; full_name: string; email: string }
}

// Resolve the personal organization owned by a coach. A user's personal org is
// the one where created_by equals their user id; a coach should own exactly one.
export async function resolveCoachOrg(
  client: ServiceRoleClient,
  coachUserId: string,
): Promise<string> {
  const result = await client
    .from('organizations')
    .select('id')
    .eq('created_by', coachUserId)

  if (result.error) {
    throw new Error(`Failed to resolve coach organization: ${result.error.message}`)
  }

  const rows = (result.data ?? []) as unknown as OrgIdRow[]
  if (rows.length === 0) {
    throw new CoachResolutionError(`Coach ${coachUserId} owns no organization`)
  }
  if (rows.length > 1) {
    throw new CoachResolutionError(
      `Coach ${coachUserId} owns ${rows.length} organizations; expected exactly one`,
    )
  }
  return rows[0].id
}

// List coaches: every user who owns an organization (joined with their profile
// for name/email). The result is capped at ADMIN_BATCH_CAP so an admin request
// can never pull an unbounded number of rows.
export async function listCoaches(
  client: ServiceRoleClient,
): Promise<CoachSummary[]> {
  const result = await client
    .from('organizations')
    .select('id, created_by, profiles(id, full_name, email)')

  if (result.error) {
    throw new Error(`Failed to list coaches: ${result.error.message}`)
  }

  const rows = (result.data ?? []) as unknown as OrgOwnerRow[]
  return rows
    .map((row) => ({
      userId: row.created_by,
      name: row.profiles.full_name,
      email: row.profiles.email,
      orgId: row.id,
    }))
    .slice(0, ADMIN_BATCH_CAP)
}
