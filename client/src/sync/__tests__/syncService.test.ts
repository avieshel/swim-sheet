import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest'
import { db } from '../../db/schema'
import { markDirty } from '../syncStore'
import { syncService } from '../syncService'
import type { SyncTransport, LocalChange, CloudChange, SyncTable, SyncResult } from '../types'

vi.mock('../../api/supabase', () => ({
  getCurrentUserId: () => 'user-1',
  onAuthStateChange: () => () => {},
  supabase: {},
}))

function fakeTransport(opts: { pushed?: number; pulled?: number; throwOn?: 'push' | 'pull'; pullFailures?: number; cloudChanges?: CloudChange[] } = {}): SyncTransport & { upserted: LocalChange[]; pulledTables: Array<SyncTable[] | undefined> } {
  const upserted: LocalChange[] = []
  const pulledTables: Array<SyncTable[] | undefined> = []
  let pullFailuresRemaining = opts.pullFailures ?? 0
  const transport: SyncTransport & { upserted: LocalChange[]; pulledTables: Array<SyncTable[] | undefined> } = {
    upserted,
    pulledTables,
    ensurePersonalOrganization: async () => 'org-A',
    push: async (changes: LocalChange[]) => {
      if (opts.throwOn === 'push') throw new Error('push failed')
      upserted.push(...changes)
      // Echo back a server-assigned rev so syncService stores the rev the
      // cloud would really hold (the real transport reads it from the row).
      return {
        conflicts: [],
        applied: changes.map((c) => ({
          table: c.table,
          id: c.id,
          updatedAt: `srv-${c.table}-${c.id}`,
        })),
      }
    },
    pull: async (_orgId: string, cursors: Record<SyncTable, string | null>, tables?: SyncTable[]) => {
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
      const nextCursors = {
        swimmers: cursors.swimmers ?? '0001',
        sessions: cursors.sessions ?? '0001',
        drills: cursors.drills ?? '0001',
        libraryDrills: cursors.libraryDrills ?? '0001',
        sessionRuns: cursors.sessionRuns ?? '0001',
        runDrills: cursors.runDrills ?? '0001',
        runSwimmers: cursors.runSwimmers ?? '0001',
        laps: cursors.laps ?? '0001',
        laneDrillResults: cursors.laneDrillResults ?? '0001',
      }
      const requestedTables = tables ?? [
        'swimmers', 'sessions', 'drills', 'libraryDrills', 'sessionRuns', 'runDrills', 'runSwimmers', 'laps', 'laneDrillResults',
      ]
      const page: CloudChange[] = []
      for (const table of requestedTables) {
        const cursor = cursors[table] ?? '0001'
        const rows = changes
          .filter((change) => change.table === table && change.updatedAt > cursor)
          .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id))
          .slice(0, 500)
        page.push(...rows)
        if (rows.length > 0) nextCursors[table] = rows[rows.length - 1].updatedAt
      }
      return { changes: page, nextCursors }
    },
  }
  return transport
}

function remoteSession(id: string): CloudChange {
  return {
    table: 'sessions', id, op: 'upsert',
    payload: { id, name: 'Cloud Template', notes: '', visibility: 'private', createdAt: 't', updatedAt: '2026-01-01T00:00:00.000Z' },
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
  }
}

async function runSyncNow(transport: SyncTransport): Promise<SyncResult> {
  syncService.init(transport, { autoSync: false })
  const seed = async (id: string) => {
    await db.swimmers.add({ id, name: id.toUpperCase(), group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't' })
  }
  await seed('a')
  await seed('b')
  // Record pending meta deterministically (the domain hook also does this
  // fire-and-forget; awaiting here removes the race during the test).
  await markDirty('swimmers', 'a')
  await markDirty('swimmers', 'b')
  syncService.setActiveOrg('org-A')
  const result = await syncService.syncNow()
  syncService.stop()
  return result
}

describe('syncService', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction('rw', [db.swimmers, db.sessions, db.drills, db.runDrills, db.runSwimmers, db.sessionRuns, db.laps, db.laneDrillResults, db.libraryDrills, db._meta, db._sync_meta, db._sync_cursor], async () => {
      await db.swimmers.clear()
      await db.sessions.clear()
      await db.drills.clear()
      await db.sessionRuns.clear()
      await db.runDrills.clear()
      await db.runSwimmers.clear()
      await db.laps.clear()
      await db.laneDrillResults.clear()
      await db.libraryDrills.clear()
      await db._meta.clear()
      await db._sync_meta.clear()
      await db._sync_cursor.clear()
    })
  })

  afterEach(() => {
    syncService.stop()
  })

  test('queues preexisting run children when the active run completes', async () => {
    await db.sessionRuns.add({
      id: 'run-transition', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
      notes: '', status: 'active', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
      createdAt: 'created', updatedAt: '2026-10-08T10:00:00.000Z',
    })
    await db.runDrills.add({
      id: 'run-drill-transition', runId: 'run-transition', name: 'Warmup', stroke: 'freestyle', distance: 100,
      order: 0, notes: '', createdAt: 'created', updatedAt: '2026-10-08T10:00:00.000Z',
    })
    await db.runSwimmers.add({
      id: 'run-swimmer-transition', runId: 'run-transition', swimmerId: 'swimmer-1', lane: 1,
      createdAt: 'created', updatedAt: '2026-10-08T10:00:00.000Z',
    })
    await db.laps.add({
      id: 'lap-transition', runDrillId: 'run-drill-transition', swimmerId: 'swimmer-1', time: 30,
      strokeCount: 18, effort: '', notes: '', createdAt: 'created', updatedAt: '2026-10-08T10:00:00.000Z',
    })
    await db.laneDrillResults.add({
      id: 'lane-result-transition', runId: 'run-transition', groupId: 'group-1', lane: 1,
      runDrillId: 'run-drill-transition', completed: true, data: null, updatedAt: '2026-10-08T10:00:00.000Z',
    })
    await db._meta.put({ key: 'sync:completed-history-backfill:v1:org-A', value: 'done' })
    await db.sessionRuns.update('run-transition', { status: 'completed', updatedAt: '2026-10-08T11:00:00.000Z' })
    await markDirty('sessionRuns', 'run-transition')
    await db._sync_meta.update('sessionRuns:run-transition', { orgId: 'org-A' })
    const transport = fakeTransport()
    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg('org-A')

    await syncService.syncNow()

    expect(transport.upserted.map(({ table }) => table)).toEqual([
      'sessionRuns', 'runDrills', 'runSwimmers', 'laps', 'laneDrillResults',
    ])
  })

  test('backfills local-only completed history with existing IDs', async () => {
    await db.sessionRuns.add({
      id: 'run-local', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
      notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
      createdAt: 'created', updatedAt: 'updated',
    })
    await db.runDrills.add({
      id: 'run-drill-local', runId: 'run-local', name: 'Warmup', stroke: 'freestyle', distance: 100,
      order: 0, notes: '', createdAt: 'created', updatedAt: 'updated',
    })
    await db.runSwimmers.add({
      id: 'run-swimmer-local', runId: 'run-local', swimmerId: 'swimmer-1', lane: 1,
      createdAt: 'created', updatedAt: 'updated',
    })
    await db.laps.add({
      id: 'lap-local', runDrillId: 'run-drill-local', swimmerId: 'swimmer-1', time: 30,
      strokeCount: 18, effort: '', notes: '', createdAt: 'created', updatedAt: 'updated',
    })
    await db.laneDrillResults.add({
      id: 'lane-result-local', runId: 'run-local', groupId: 'group-1', lane: 1,
      runDrillId: 'run-drill-local', completed: true, data: null, updatedAt: 'updated',
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    await db._sync_meta.clear()
    const transport = fakeTransport()
    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg('org-A')

    await syncService.syncNow()

    expect(transport.pulledTables[0]).toEqual(['sessionRuns', 'runDrills', 'runSwimmers', 'laps', 'laneDrillResults'])
    expect(transport.upserted.map(({ table, id }) => [table, id])).toEqual([
      ['sessionRuns', 'run-local'],
      ['runDrills', 'run-drill-local'],
      ['runSwimmers', 'run-swimmer-local'],
      ['laps', 'lap-local'],
      ['laneDrillResults', 'lane-result-local'],
    ])
  })

  test('reconciles a newer cloud record before uploading a same-ID pending record', async () => {
    await db.sessionRuns.add({
      id: 'run-shared', sessionId: 'session-1', date: '2026-10-08', poolName: 'Local', poolLength: 25,
      notes: 'local edit', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
      createdAt: 'created', updatedAt: '2026-10-08T10:00:00.000Z',
    })
    const cloud: CloudChange = {
      table: 'sessionRuns', id: 'run-shared', op: 'upsert',
      payload: {
        id: 'run-shared', sessionId: 'session-1', date: '2026-10-08', poolName: 'Cloud', poolLength: 25,
        notes: 'newer cloud edit', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null,
        sessionPauseDuration: 0, createdAt: 'created', updatedAt: '2026-10-08T11:00:00.000Z',
      },
      updatedAt: '2026-10-08T11:00:00.000Z', deletedAt: null,
    }
    await markDirty('sessionRuns', 'run-shared')
    await db._sync_meta.update('sessionRuns:run-shared', { orgId: 'org-A' })
    const transport = fakeTransport({ cloudChanges: [cloud] })
    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg('org-A')

    await syncService.syncNow()

    expect(transport.upserted.some((change) => change.id === 'run-shared')).toBe(false)
    expect((await db.sessionRuns.get('run-shared'))?.notes).toBe('newer cloud edit')
  })

  test('does not treat same-ID rows beyond the first history page as local-only', async () => {
    const cloudChanges: CloudChange[] = Array.from({ length: 500 }, (_, index) => {
      const id = `run-cloud-${index}`
      const updatedAt = `2026-10-08T10:00:00.${String(index).padStart(3, '0')}Z`
      return {
        table: 'sessionRuns', id, op: 'upsert',
        payload: {
          id, sessionId: 'session-1', date: '2026-10-08', poolName: 'Cloud', poolLength: 25,
          notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null,
          sessionPauseDuration: 0, createdAt: 'created', updatedAt,
        },
        updatedAt, deletedAt: null,
      }
    })
    cloudChanges.push({
      table: 'sessionRuns', id: 'run-after-page', op: 'upsert',
      payload: {
        id: 'run-after-page', sessionId: 'session-1', date: '2026-10-08', poolName: 'Cloud', poolLength: 25,
        notes: 'newer cloud row', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null,
        sessionPauseDuration: 0, createdAt: 'created', updatedAt: '2026-10-08T11:00:00.000Z',
      },
      updatedAt: '2026-10-08T11:00:00.000Z', deletedAt: null,
    })
    await db.sessionRuns.add({
      id: 'run-after-page', sessionId: 'session-1', date: '2026-10-08', poolName: 'Local', poolLength: 25,
      notes: 'older local row', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null,
      sessionPauseDuration: 0, createdAt: 'created', updatedAt: '2026-10-08T10:30:00.000Z',
    })
    await markDirty('sessionRuns', 'run-after-page')
    await db._sync_meta.update('sessionRuns:run-after-page', { orgId: 'org-A' })
    const transport = fakeTransport({ cloudChanges })
    syncService.init(transport, { autoSync: false })
    syncService.setActiveOrg('org-A')

    await syncService.syncNow()

    expect(transport.upserted.some((change) => change.id === 'run-after-page')).toBe(false)
    expect((await db.sessionRuns.get('run-after-page'))?.notes).toBe('newer cloud row')
    expect(await db.sessionRuns.count()).toBe(501)
    expect(transport.pulledTables.slice(0, 3)).toEqual([
      ['sessionRuns', 'runDrills', 'runSwimmers', 'laps', 'laneDrillResults'],
      ['sessionRuns', 'runDrills', 'runSwimmers', 'laps', 'laneDrillResults'],
      ['sessionRuns', 'runDrills', 'runSwimmers', 'laps', 'laneDrillResults'],
    ])
  })

  test('counts only completed history in first-merge summary', async () => {
    await db.sessionRuns.add({
      id: 'run-active', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
      notes: '', status: 'active', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
      createdAt: 'created', updatedAt: 'updated',
    })
    await db.runDrills.add({
      id: 'run-drill-active', runId: 'run-active', name: 'Warmup', stroke: 'freestyle', distance: 100,
      order: 0, notes: '', createdAt: 'created', updatedAt: 'updated',
    })
    const transport = fakeTransport()

    const summary = await syncService.previewFirstMerge(transport, 'org-A')

    expect(summary.localCount).toBe(0)
  })

  test('does not sync history while first merge awaits confirmation', async () => {
    await db.sessionRuns.add({
      id: 'run-awaiting-merge', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
      notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
      createdAt: 'created', updatedAt: 'updated',
    })
    await markDirty('sessionRuns', 'run-awaiting-merge')
    const transport = fakeTransport()
    syncService.init(transport, { autoSync: false })

    await syncService.start()
    expect(syncService.getState().phase).toBe('needs_first_merge')

    await syncService.syncNow()

    expect(transport.upserted).toHaveLength(0)
  })

  test('uploads completed history after first merge is confirmed', async () => {
    await db.sessionRuns.add({
      id: 'run-confirmed-merge', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
      notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
      createdAt: 'created', updatedAt: 'updated',
    })
    const transport = fakeTransport()
    syncService.init(transport, { autoSync: false })

    await syncService.start()
    expect(syncService.getState().phase).toBe('needs_first_merge')
    await syncService.confirmFirstMerge()

    expect(transport.upserted.map(({ table, id }) => [table, id])).toContainEqual(['sessionRuns', 'run-confirmed-merge'])
  })

  test('does not upload after a first-merge preview fails', async () => {
    await db.sessionRuns.add({
      id: 'run-preview-failed', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
      notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
      createdAt: 'created', updatedAt: 'updated',
    })
    await markDirty('sessionRuns', 'run-preview-failed')
    const transport = fakeTransport({ pullFailures: 1 })
    syncService.init(transport, { autoSync: false })

    await syncService.start()
    await syncService.syncNow()

    expect(transport.upserted).toHaveLength(0)
    expect(syncService.getState().phase).toBe('error')
  })

  // The first-sync gate asks "does this device hold data worth protecting?".
  // Catalog-seeded rows (builtin drills, the default session template) are
  // written by the app before sign-in, so counting them as local data blocks
  // every second device behind a review prompt it has nothing to review.
  describe('first-sync gate decision', () => {
    // Rows seeded here must be removed before draining: the shared beforeEach
    // clears these tables, and a non-empty clear() fires Dexie `deleting` hooks,
    // whose deferred capture would otherwise mark tombstones pending inside the
    // NEXT test and inflate its pushed count. Clear, drain, then drop the journal.
    afterEach(async () => {
      await db.transaction('rw', [db.swimmers, db.sessions, db.drills, db.libraryDrills], async () => {
        await db.swimmers.clear()
        await db.sessions.clear()
        await db.drills.clear()
        await db.libraryDrills.clear()
      })
      for (let i = 0; i < 5; i++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      await db._sync_meta.clear()
    })

    async function seedSeededOnly(): Promise<void> {
      await db.libraryDrills.add({
        id: 'builtin-1', name: 'Catch Up', stroke: 'freestyle', distance: 100, items: [],
        repeatCount: 1, timingMode: 'individual', focus: 'technique', labels: [], description: 'd',
        source: 'builtin', catalogKey: 'Catch Up', popularity: 0, createdAt: 't', updatedAt: 't',
      })
      await db.sessions.add({
        id: 'seeded-session', name: 'Distance Progression', poolLength: 25, notes: '',
        visibility: 'private', catalogKey: 'Distance Progression', createdAt: 't', updatedAt: 't',
      })
      // Real names from client/src/data/sessions.json: the seeded-drill check
      // matches against the catalog, so a stand-in name would read as coach work.
      for (const [index, name] of ['Easy Free', 'Kickboard'].entries()) {
        await db.drills.add({
          id: `seeded-drill-${index}`, sessionId: 'seeded-session', name, stroke: 'freestyle',
          distance: 100, order: index, items: [], repeatCount: 1, timingMode: 'individual',
          focus: 'technique', labels: [], description: '', createdAt: 't', updatedAt: 't',
        })
      }
    }

    test('an empty device pulls from the cloud without prompting', async () => {
      const transport = fakeTransport({ cloudChanges: [remoteSession('cloud-session')] })
      syncService.init(transport, { autoSync: false })

      await syncService.start()

      expect(syncService.getState().phase).toBe('ready')
      expect((await db.sessions.get('cloud-session'))?.name).toBe('Cloud Template')
    })

    test('a device holding only catalog-seeded rows pulls without prompting', async () => {
      await seedSeededOnly()
      const transport = fakeTransport({ cloudChanges: [remoteSession('cloud-session')] })
      syncService.init(transport, { autoSync: false })

      await syncService.start()

      expect(syncService.getState().phase).toBe('ready')
      expect((await db.sessions.get('cloud-session'))?.name).toBe('Cloud Template')
    })

    test('a device holding a coach-created session prompts for review', async () => {
      await db.sessions.add({
        id: 'my-session', name: 'My Squad Plan', poolLength: 25, notes: '',
        visibility: 'private', createdAt: 't', updatedAt: 't',
      })
      const transport = fakeTransport({ cloudChanges: [remoteSession('cloud-session')] })
      syncService.init(transport, { autoSync: false })

      await syncService.start()

      expect(syncService.getState().phase).toBe('needs_first_merge')
      expect(await db.sessions.get('cloud-session')).toBeUndefined()
    })

    test('a drill added to a seeded template still counts as coach-authored', async () => {
      await seedSeededOnly()
      await db.drills.add({
        id: 'my-drill', sessionId: 'seeded-session', name: 'Race Pace 200', stroke: 'freestyle',
        distance: 200, order: 99, items: [], repeatCount: 1, timingMode: 'individual',
        focus: 'fitness', labels: [], description: '', createdAt: 't', updatedAt: 't',
      })
      await db.libraryDrills.add({
        id: 'my-library-drill', name: 'Race Pace 200', stroke: 'freestyle', distance: 200, items: [],
        repeatCount: 1, timingMode: 'individual', focus: 'fitness', labels: [], description: '',
        source: 'personal', createdAt: 't', updatedAt: 't',
      })
      const transport = fakeTransport({ cloudChanges: [remoteSession('cloud-session')] })
      syncService.init(transport, { autoSync: false })

      await syncService.start()

      // The drill itself has no catalogKey — it inherits "not mine" from the
      // seeded session it hangs off. A flat per-table check would miss this and
      // silently discard the coach's edit.
      expect(syncService.getState().phase).toBe('needs_first_merge')
    })

    test('a device holding a coach-created swimmer prompts for review', async () => {
      await db.swimmers.add({ id: 'my-swimmer', name: 'Dan', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't' })
      const transport = fakeTransport({ cloudChanges: [remoteSession('cloud-session')] })
      syncService.init(transport, { autoSync: false })

      await syncService.start()

      expect(syncService.getState().phase).toBe('needs_first_merge')
      expect(await db.sessions.get('cloud-session')).toBeUndefined()
    })

    test('a device holding completed run history prompts for review', async () => {
      await db.sessionRuns.add({
        id: 'my-run', sessionId: 'my-session', date: '2026-10-08', poolName: 'North', poolLength: 25,
        notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
        createdAt: 't', updatedAt: 't',
      })
      const transport = fakeTransport({ cloudChanges: [remoteSession('cloud-session')] })
      syncService.init(transport, { autoSync: false })

      await syncService.start()

      expect(syncService.getState().phase).toBe('needs_first_merge')
    })

    test('a synced device never re-prompts on a later sync', async () => {
      await db.swimmers.add({ id: 'my-swimmer', name: 'Dan', group: '', labels: [], notes: '', status: 'active', createdAt: 't', updatedAt: 't' })
      const transport = fakeTransport({ cloudChanges: [remoteSession('cloud-session')] })
      syncService.init(transport, { autoSync: false })
      await syncService.start()
      expect(syncService.getState().phase).toBe('needs_first_merge')

      await syncService.confirmFirstMerge()
      expect(syncService.getState().phase).toBe('ready')

      await syncService.syncNow()

      expect(syncService.getState().phase).toBe('ready')
    })
  })

  test('syncNow pushes pending local rows then applies pulled rows', async () => {
    const transport = fakeTransport({ pushed: 2, pulled: 1 })
    const result = await runSyncNow(transport)
    expect(result.pushed).toBe(2)
    expect(result.pulled).toBe(1)
    expect(result.conflicts).toHaveLength(0)
    expect(await db.swimmers.get('pulled-0')).toBeTruthy()
  })

  test('syncNow swallows transport errors and reports them without throwing', async () => {
    const transport = fakeTransport({ throwOn: 'push' })
    const result = await runSyncNow(transport)
    expect(result.error?.kind).toBe('unexpected')
  })
})
