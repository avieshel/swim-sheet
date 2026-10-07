export type SyncTable = 'swimmers' | 'sessions' | 'drills' | 'libraryDrills'

export type SyncOp = 'upsert' | 'delete'

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

export type SyncErrorKind = 'offline' | 'auth' | 'conflict' | 'validation' | 'unexpected'

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
  push(changes: LocalChange[], orgId: string): Promise<{ conflicts: SyncConflict[] }>
  pull(orgId: string, cursors: Record<SyncTable, string | null>): Promise<{
    changes: CloudChange[]
    nextCursors: Record<SyncTable, string>
  }>
}
