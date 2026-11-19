export type SyncTable =
  | 'swimmers'
  | 'sessions'
  | 'drills'
  | 'libraryDrills'
  | 'sessionRuns'
  | 'runDrills'
  | 'runSwimmers'
  | 'laps'
  | 'laneDrillResults'

export const HISTORY_TABLES: SyncTable[] = [
  'sessionRuns',
  'runDrills',
  'runSwimmers',
  'laps',
  'laneDrillResults',
]

// The session-plan layer: the reusable templates a coach and owner collaborate
// on (coach creates → owner validates/tunes → coach records). These are the only
// tables that get owner-aware sync semantics (editor tracking, owner-wins-on-
// conflict, and a "plan updated by someone else" signal). Swimmers and history
// stay on the generic last-write-wins sync.
export const PLAN_TABLES: SyncTable[] = ['sessions', 'drills', 'libraryDrills']

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
  // The cloud `updated_by` of the row that produced this change — the acting
  // auth user who last edited it. Present for plan tables once the
  // plan_editor_tracking migration has been applied; undefined otherwise. Used
  // to surface "someone else updated your plan" without persisting it locally.
  editorId?: string
}

export interface SyncConflict {
  id: string
  table: SyncTable
  rowId: string
  local: Record<string, unknown> | null
  remote: Record<string, unknown>
  localRev: string | null
  remoteRev: string
  // For plan-table conflicts the owner's edit is authoritative, so the UI is
  // advised to default its selection to 'remote'. Undefined elsewhere.
  recommendedResolution?: 'local' | 'remote'
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
  // Plan rows (sessions/drills/libraryDrills) pulled this sync that were last
  // edited by someone other than the local user — the coach-assist signal that
  // "an owner (or teammate) tuned your plan". Cleared at the start of each sync.
  planUpdatesByOther?: Array<{ table: SyncTable; id: string; editorId: string }>
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
  pull(orgId: string, cursors: Record<SyncTable, string | null>, tables?: SyncTable[]): Promise<{
    changes: CloudChange[]
    nextCursors: Record<SyncTable, string>
  }>
}
