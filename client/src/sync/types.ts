export type SyncTable = 'swimmers' | 'sessions' | 'drills' | 'libraryDrills'

type SyncOp = 'upsert' | 'delete'

export interface LocalChange {
  table: SyncTable
  id: string
  op: SyncOp
  payload?: Record<string, unknown>
  catalogKey?: string
  rev: string | null
}

export interface CloudChange {
  table: SyncTable
  id: string
  op: SyncOp
  payload: Record<string, unknown>
  catalogKey?: string
  updatedAt: string
  deletedAt: string | null
}

export interface SyncConflict {
  id: string
  table: SyncTable
  rowId: string
  local: Record<string, unknown> | null
  remote: Record<string, unknown>
  localRev: string | null
  remoteRev: string
}

export type SyncPhase =
  | 'idle'
  | 'initializing'
  | 'pushing'
  | 'pulling'
  | 'ready'
  | 'error'
  | 'needs_first_merge'

type SyncErrorKind = 'offline' | 'auth' | 'conflict' | 'validation' | 'unexpected'

export interface SyncError {
  kind: SyncErrorKind
  message: string
}

export interface SyncState {
  signedIn: boolean
  phase: SyncPhase
  lastSyncAt: string | null
  pendingCount: number
  inFlight: boolean
  error: SyncError | null
  conflicts: SyncConflict[]
  firstMergeSummary?: FirstMergeSummary | null
}

export interface SyncResult {
  pushed: number
  pulled: number
  conflicts: SyncConflict[]
  error?: SyncError
}

export interface FirstMergeSummary {
  localCount: number
  cloudCount: number
  catalogMatches: number
  ambiguous: number
}

export interface SyncTransport {
  ensurePersonalOrganization(): Promise<string>
  // applied carries the server-assigned updated_at per pushed row. The cloud
  // sets updated_at with now() via trigger, so the client's own timestamp is
  // never the rev it must guard its next write with.
  push(changes: LocalChange[], orgId: string): Promise<{
    conflicts: SyncConflict[]
    applied: { table: SyncTable; id: string; updatedAt: string }[]
  }>
  pull(orgId: string, cursors: Record<SyncTable, string | null>): Promise<{
    changes: CloudChange[]
    nextCursors: Record<SyncTable, string>
  }>
}
