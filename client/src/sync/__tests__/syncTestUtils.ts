// Shared test fixtures for the sync suite. The eight sync test files each needed
// a fake transport, a table-name helper, and an empty-cursor builder; those were
// copy-pasted with subtly different behavior. This module is the single owner of
// the common shape: makeFakeTransport captures pushed LocalChanges verbatim and
// returns the server-assigned revs the real transport would, and its pull applies
// the same cursor/nextCursors logic the Supabase transport uses. Per-file quirks
// (a throwing setup, a custom pull) are passed as overrides rather than re-impl.
import type { CloudChange, LocalChange, SyncTable, SyncTransport } from '../types'

export const asSyncTable = (table: string): SyncTable => table as unknown as SyncTable

export function emptyCursors(): Record<SyncTable, string | null> {
  return {
    swimmers: null,
    sessions: null,
    drills: null,
    libraryDrills: null,
    sessionRuns: null,
    runDrills: null,
    runSwimmers: null,
    laps: null,
    laneDrillResults: null,
  }
}

const ALL_TABLES: SyncTable[] = [
  'swimmers',
  'sessions',
  'drills',
  'libraryDrills',
  'sessionRuns',
  'runDrills',
  'runSwimmers',
  'laps',
  'laneDrillResults',
]

export interface FakeTransportOpts {
  userId?: string
  personalOrg?: string
  throwOn?: 'push' | 'pull'
  pullFailures?: number
  cloudChanges?: CloudChange[]
  pulled?: number
  cursorDefault?: string
  pull?: SyncTransport['pull']
  ensurePersonalOrganization?: SyncTransport['ensurePersonalOrganization']
}

export function makeFakeTransport(opts: FakeTransportOpts = {}): SyncTransport & {
  upserted: LocalChange[]
  sent: LocalChange[]
  pulledTables: Array<SyncTable[] | undefined>
} {
  const upserted: LocalChange[] = []
  const sent: LocalChange[] = []
  const pulledTables: Array<SyncTable[] | undefined> = []
  let pullFailuresRemaining = opts.pullFailures ?? 0

  const ensurePersonalOrganization =
    opts.ensurePersonalOrganization ?? (async () => opts.personalOrg ?? 'org-A')

  const push: SyncTransport['push'] = async (changes: LocalChange[]) => {
    if (opts.throwOn === 'push') throw new Error('push failed')
    sent.push(...changes)
    for (const c of changes) {
      upserted.push(c)
    }
    // Echo back a server-assigned rev so syncService stores the rev the cloud
    // would really hold (the real transport reads it from the row).
    return {
      conflicts: [],
      applied: changes.map((c) => ({
        table: c.table,
        id: c.id,
        updatedAt: `srv-${c.table}-${c.id}`,
      })),
    }
  }

  const defaultPull: SyncTransport['pull'] = async (_orgId, cursors, tables) => {
    if (opts.throwOn === 'pull' || pullFailuresRemaining > 0) {
      pullFailuresRemaining--
      throw new Error('pull failed')
    }
    pulledTables.push(tables)
    const changes: CloudChange[] = [...(opts.cloudChanges ?? [])]
    const n = opts.pulled ?? 0
    for (let i = 0; i < n && (!tables || tables.includes('swimmers')); i++) {
      const id = `pulled-${i}`
      changes.push({
        table: 'swimmers',
        id,
        op: 'upsert',
        payload: { id, name: 'P', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: `t-pull-${i}` },
        catalogKey: undefined,
        updatedAt: `t-pull-${i}`,
        deletedAt: null,
      })
    }
    const def = opts.cursorDefault ?? ''
    const nextCursors = {
      swimmers: cursors.swimmers ?? def,
      sessions: cursors.sessions ?? def,
      drills: cursors.drills ?? def,
      libraryDrills: cursors.libraryDrills ?? def,
      sessionRuns: cursors.sessionRuns ?? def,
      runDrills: cursors.runDrills ?? def,
      runSwimmers: cursors.runSwimmers ?? def,
      laps: cursors.laps ?? def,
      laneDrillResults: cursors.laneDrillResults ?? def,
    }
    const requestedTables = tables ?? ALL_TABLES
    const page: CloudChange[] = []
    for (const table of requestedTables) {
      const cursor = cursors[table] ?? def
      const rows = changes
        .filter((change) => change.table === table && change.updatedAt > cursor)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id))
        .slice(0, 500)
      page.push(...rows)
      if (rows.length > 0) nextCursors[table] = rows[rows.length - 1].updatedAt
    }
    return { changes: page, nextCursors }
  }

  const pull = opts.pull ?? defaultPull

  return {
    upserted,
    sent,
    pulledTables,
    ensurePersonalOrganization,
    push,
    pull,
  } as SyncTransport & {
    upserted: LocalChange[]
    sent: LocalChange[]
    pulledTables: Array<SyncTable[] | undefined>
  }
}
