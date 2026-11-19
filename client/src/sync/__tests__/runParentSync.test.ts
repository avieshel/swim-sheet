import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest'
import { db } from '../../db/schema'
import { markDirty } from '../syncStore'
import { syncService } from '../syncService'
import type { CloudChange, LocalChange, SyncConflict, SyncTable, SyncTransport } from '../types'

// avi's real failure: a completed run references a session_id that is absent from
// the CLOUD sessions table. `pruneOrphanRuns` (which only checks the *local*
// sessions table) cannot catch this, because the parent exists on the device but
// was never pushed / was dropped from the cloud. The push then trips
// session_runs_session_id_fkey (23503) and aborts the whole sync — blocking the
// pull that delivers coach-assist edits. These tests verify the two new layers:
// enqueueRunParentSessions (push a local-but-unpushed parent first) and the
// push-time 23503 recovery (quarantine the offending run and retry).
class FkSimulatingTransport implements SyncTransport {
  public pushed: LocalChange[] = []
  public cloudSessions = new Set<string>(['s-pre-pushed'])
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
              details: `Key (session_id)=(${sid}) is not present in table "sessions".`,
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
        id: 's-pre-pushed',
        op: 'upsert',
        payload: {
          id: 's-pre-pushed',
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

describe('run parent sync (cloud-absent session_id)', () => {
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

  test('a local-but-unpushed parent session is enqueued and pushed before its run', async () => {
    // Parent session exists locally but has no sync meta (never queued by the
    // history backfill, which only processes history tables).
    await db.sessions.add({
      id: 's-local',
      name: 'Local Session',
      poolLength: 25,
      notes: '',
      visibility: 'private',
      catalogKey: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    // The completed run IS queued (as the backfill would), but without its parent.
    await db.sessionRuns.add({
      id: 'run-1',
      sessionId: 's-local',
      date: '2026-01-02',
      poolName: 'Pool',
      poolLength: 25,
      notes: '',
      status: 'completed',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    await new Promise((r) => setTimeout(r, 0))
    await markDirty('sessionRuns', 'run-1')

    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg(ORG)

    const result = await syncService.syncNow()

    expect(result.error).toBeUndefined()
    expect(syncService.getState().phase).toBe('ready')
    // Both the parent session and the run were pushed, in an order that satisfies
    // the FK (session first).
    expect(transport.pushed.some((c) => c.table === 'sessions' && c.id === 's-local')).toBe(true)
    expect(transport.pushed.some((c) => c.table === 'sessionRuns' && c.id === 'run-1')).toBe(true)
  })

  // Mirrors the production failure: the 23503 arrives WITHOUT a parseable
  // `Key (session_id)=(...)` detail, so extractFkViolationSessionIds finds
  // nothing and the old code re-threw forever. Recovery must identify the bad
  // run by re-pushing each run individually instead of parsing the message.
  class FkNoDetailTransport extends FkSimulatingTransport {
    override async push(changes: LocalChange[]): Promise<{ conflicts: SyncConflict[]; applied: { table: SyncTable; id: string; updatedAt: string }[] }> {
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
  }

  test('a 23503 without parseable detail quarantines only the orphan run, not a valid one', async () => {
    const transport = new FkNoDetailTransport()
    // Valid run: references a session the cloud already has.
    await db.sessions.add({
      id: 's-pre-pushed',
      name: 'Coach Edited',
      poolLength: 25,
      notes: '',
      visibility: 'private',
      catalogKey: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await db.sessionRuns.add({
      id: 'run-ok',
      sessionId: 's-pre-pushed',
      date: '2026-01-02',
      poolName: 'Pool',
      poolLength: 25,
      notes: '',
      status: 'completed',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    // Orphan run: parent session is marked synced locally but absent from the cloud.
    await db.sessions.add({
      id: 's-gone',
      name: 'Session',
      poolLength: 25,
      notes: '',
      visibility: 'private',
      catalogKey: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await db.sessionRuns.add({
      id: 'run-gone',
      sessionId: 's-gone',
      date: '2026-01-02',
      poolName: 'Pool',
      poolLength: 25,
      notes: '',
      status: 'completed',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    await new Promise((r) => setTimeout(r, 0))
    await markDirty('sessionRuns', 'run-ok')
    await markDirty('sessionRuns', 'run-gone')
    await db._sync_meta.put({
      key: 'sessions:s-gone',
      orgId: ORG,
      table: 'sessions',
      rowId: 's-gone',
      catalogKey: undefined,
      rev: '2026-01-01T00:00:00.000Z',
      status: 'synced',
      deleted: 0,
    })

    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg(ORG)

    const result = await syncService.syncNow()

    expect(result.error).toBeUndefined()
    expect(syncService.getState().phase).toBe('ready')
    // Only the orphan run is quarantined; the valid run is pushed and kept.
    expect(await db.sessionRuns.get('run-gone')).toBeUndefined()
    expect(transport.pushed.some((c) => c.table === 'sessionRuns' && c.id === 'run-gone')).toBe(false)
    expect(transport.pushed.some((c) => c.table === 'sessionRuns' && c.id === 'run-ok')).toBe(true)
    expect(await db.sessionRuns.get('run-ok')).toBeDefined()
  })

  test('a run whose parent is gone from the cloud but synced locally is quarantined at push time', async () => {
    // Parent session is marked synced locally, so dropUnsafeRuns keeps the run,
    // but the cloud no longer has it -> 23503 -> push-time recovery quarantines
    // the run and sync still completes (with the pull delivering the coach edit).
    await db.sessions.add({
      id: 's-gone',
      name: 'Session',
      poolLength: 25,
      notes: '',
      visibility: 'private',
      catalogKey: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await db.sessionRuns.add({
      id: 'run-gone',
      sessionId: 's-gone',
      date: '2026-01-02',
      poolName: 'Pool',
      poolLength: 25,
      notes: '',
      status: 'completed',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    await new Promise((r) => setTimeout(r, 0))
    await markDirty('sessionRuns', 'run-gone')
    // Stale "synced" meta for the parent: it exists locally but not in the cloud.
    await db._sync_meta.put({
      key: 'sessions:s-gone',
      orgId: ORG,
      table: 'sessions',
      rowId: 's-gone',
      catalogKey: undefined,
      rev: '2026-01-01T00:00:00.000Z',
      status: 'synced',
      deleted: 0,
    })

    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg(ORG)

    const result = await syncService.syncNow()

    // The 23503 no longer aborts the sync.
    expect(result.error).toBeUndefined()
    expect(syncService.getState().phase).toBe('ready')
    // The offending run is gone from the device (quarantined), never pushed.
    expect(await db.sessionRuns.get('run-gone')).toBeUndefined()
    expect(transport.pushed.some((c) => c.table === 'sessionRuns' && c.id === 'run-gone')).toBe(false)
    // The pull phase still ran, so the coach-assist edit landed.
    expect((await db.sessions.get('s-pre-pushed'))?.name).toBe('Coach Edited')
  })
})
