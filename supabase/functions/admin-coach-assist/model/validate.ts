// Structural safety layer for owner-scoped writes. Pure: no Supabase, no env,
// no I/O. It only enforces that an admin write can never target a table outside
// the allowlist, nor override the enforced org/owner of the row.

import { ADMIN_WRITABLE_TABLES } from './config.ts'
import type { ScopedTable, ScopedWrite } from './types.ts'

// Keys an admin write must never be able to set from the caller-supplied
// payload. The service layer always stamps these from the resolved scope.
const RESERVED_KEYS = ['organization_id', 'created_by']

export class ScopedWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScopedWriteError'
  }
}

export type NormalizedScopedWrite = {
  organization_id: string
  created_by: string
  [key: string]: unknown
}

export function normalizeScopedWrite(
  input: ScopedWrite,
): NormalizedScopedWrite {
  if (!input.orgId || input.orgId.trim().length === 0) {
    throw new ScopedWriteError('orgId is required for a scoped write')
  }

  if (!ADMIN_WRITABLE_TABLES.includes(input.table)) {
    throw new ScopedWriteError(
      `table '${input.table}' is not an admin-writable scope`,
    )
  }

  const result: NormalizedScopedWrite = {
    organization_id: input.orgId,
    created_by: input.coachUserId,
  }

  for (const [key, value] of Object.entries(input.payload)) {
    if (RESERVED_KEYS.includes(key)) continue
    result[key] = value
  }

  return result
}
