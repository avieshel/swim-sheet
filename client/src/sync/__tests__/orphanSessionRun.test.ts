import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest'
import { db } from '../../db/schema'
import { markDirty } from '../syncStore'
import { syncService } from '../syncService'
import type { CloudChange, LocalChange, SyncConflict, SyncTable, SyncTransport } from '../types'

// Mirrors the production failure: a local session_runs row whose session_id is
// not present in the cloud sessions table. The real transport surfaces this as a
// 23503 FK violation (session_runs_session_id_fkey) and aborts the whole push.
// Before the prune fix, that abort skipped the pull phase entirely, so a coach's
// device would never receive coach-assist edits.
class FkSimulatingTransport implements SyncTransport {
  public pushed: LocalChange[] = []
  public cloudSessions = new Set<string>(['s-valid'])
  private orgId = 'org-avi'

  async ensurePersonalOrganization(): Promise<string> {
    return this.orgId
  }

  async push(changes: LocalChange[]): Promise<{ conflicts: SyncConflict[]; applied: { table: SyncTable; id: string; updatedAt: string }[] }> {
    const conflicts: SyncConflict[] = []
    const applied: { table: SyncTable; id: string; updatedAt: string }[] = []
    for (const c of changes) {
      if (c.table === 'sessionRuns' && c.op === 'upsert') {
        const sid = (c.payload?.sessionId as string | undefined) ?? ''
        if (!this.cloudSessions.has(sid)) {
          throw Object.assign(new Error('failed to push session_runs'), {
            kind: 'network',
            cause: {
              code: '23503',
              message:
                'insert or update on table "session_runs" violates foreign key constraint "session_runs_session_id_fkey"',
            },
          })
        }
      }
      this.pushed.push(c)
      applied.push({ table: c.table, id: c.id, updatedAt: new Date().toISOString() })
      if (c.table === 'sessions' && c.op === 'upsert') this.cloudSessions.add(c.id)
    }
    return { conflicts, applied }
  }

  async pull(
    _orgId: string,
    _cursors: Record<SyncTable, string | null>,
    tables?: SyncTable[],
  ): Promise<{ changes: CloudChange[]; nextCursors: Record<SyncTable, string> }> {
    // The completed-history backfill pulls only HISTORY_TABLES; honor that so it
    // terminates. The final pull (no table filter) is where the coach-assist
    // edit arrives.
    const wantSessions = !tables || tables.includes('sessions')
    const changes: CloudChange[] = []
    if (wantSessions) {
      changes.push({
        table: 'sessions',
        id: 's-valid',
        op: 'upsert',
        payload: {
          id: 's-valid',
          name: 'Coach Edited',
          poolLength: 25,
          notes: '',
          visibility: 'private',
          catalogKey: undefined,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-12-01T00:00:00.000Z',
        },
        catalogKey: undefined,
        updatedAt: '2026-12-01T00:00:00.000Z',
        deletedAt: null,
      })
    }
    const nextCursors: Record<SyncTable, string> = {
      swimmers: '0001',
      sessions: '2026-12-01T00:00:00.000Z',
      drills: '0001',
      libraryDrills: '0001',
      sessionRuns: '0001',
      runDrills: '0001',
      runSwimmers: '0001',
      laps: '0001',
      laneDrillResults: '0001',
    }
    return { changes, nextCursors }
  }
}

const ORG = 'org-avi'

vi.mock('../../api/supabase', () => ({
  getCurrentUserId: () => 'coach-avi',
  onAuthStateChange: () => () => {},
  supabase: {},
}))

describe('orphaned session_runs must not block the push (and therefore the pull)', () => {
  let transport: FkSimulatingTransport

  beforeEach(async () => {
    transport = new FkSimulatingTransport()
    await db.open()
    await db.transaction(
      'rw',
      [db.sessions, db.sessionRuns, db._meta, db._sync_meta, db._sync_cursor],
      async () => {
        await db.sessions.clear()
        await db.sessionRuns.clear()
        await db._meta.clear()
        await db._sync_meta.clear()
        await db._sync_cursor.clear()
      },
    )
  })

  afterEach(() => {
    syncService.stop()
  })

  test('an orphaned run is pruned locally so the push succeeds and the pull (coach edit) arrives', async () => {
    // Valid session the coach actually owns (present in cloud).
    await db.sessions.add({
      id: 's-valid',
      name: 'My Session',
      poolLength: 25,
      notes: '',
      visibility: 'private',
      catalogKey: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    // Orphan run: references a session that does not exist on the device or
    // cloud (the classic "previous version" / stuck-sync symptom).
    await db.sessionRuns.add({
      id: 'run-orphan',
      sessionId: 's-missing',
      date: '2026-01-02',
      poolName: 'Pool',
      poolLength: 25,
      notes: '',
      status: 'completed',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    await new Promise((r) => setTimeout(r, 0))
    await markDirty('sessions', 's-valid')
    await markDirty('sessionRuns', 'run-orphan')

    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg(ORG)

    const result = await syncService.syncNow()

    // The sync must not report the 23503 error.
    expect(result.error).toBeUndefined()
    expect(syncService.getState().phase).toBe('ready')

    // The orphan run is gone from the local device (pruned), never pushed.
    expect(await db.sessionRuns.get('run-orphan')).toBeUndefined()
    expect(transport.pushed.some((c) => c.table === 'sessionRuns' && c.id === 'run-orphan')).toBe(false)

    // The valid session was pushed.
    expect(transport.pushed.some((c) => c.table === 'sessions' && c.id === 's-valid')).toBe(true)

    // Critically: the pull phase ran, so the coach-assist edit landed in Dexie.
    expect((await db.sessions.get('s-valid'))?.name).toBe('Coach Edited')
  })

  test('a run whose session DOES exist is pushed normally (not pruned)', async () => {
    await db.sessions.add({
      id: 's-valid',
      name: 'My Session',
      poolLength: 25,
      notes: '',
      visibility: 'private',
      catalogKey: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await db.sessionRuns.add({
      id: 'run-ok',
      sessionId: 's-valid',
      date: '2026-01-02',
      poolName: 'Pool',
      poolLength: 25,
      notes: '',
      status: 'completed',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    await new Promise((r) => setTimeout(r, 0))
    await markDirty('sessions', 's-valid')
    await markDirty('sessionRuns', 'run-ok')

    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg(ORG)

    const result = await syncService.syncNow()

    expect(result.error).toBeUndefined()
    // The valid run was pushed (not pruned) because its session exists.
    expect(transport.pushed.some((c) => c.table === 'sessionRuns' && c.id === 'run-ok')).toBe(true)
    expect(await db.sessionRuns.get('run-ok')).toBeDefined()
  })
})
