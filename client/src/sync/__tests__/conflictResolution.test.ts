import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import { db } from '../../db/schema'
import { syncService } from '../syncService'
import { setMetaConflict, readSyncState } from '../syncStore'
import type { SyncTransport, SyncConflict } from '../types'
import { makeFakeTransport } from './syncTestUtils'

async function seedConflict(
  table: 'swimmers' | 'sessions' | 'drills' | 'libraryDrills',
  rowId: string,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  localRev: string,
  remoteRev: string,
): Promise<void> {
  await (db[table] as unknown as { put: (v: Record<string, unknown>) => Promise<unknown> }).put({ id: rowId, ...local })
  const conflict: SyncConflict = {
    id: `${table}:${rowId}`,
    table,
    rowId,
    local,
    remote,
    localRev,
    remoteRev,
  }
  await setMetaConflict(conflict)
  await db._sync_meta.update(`${table}:${rowId}`, { orgId: 'org-A' })
}

async function seedDeleteConflict(): Promise<void> {
  await db._sync_meta.put({
    key: 'sessionRuns:run-deleted', orgId: 'org-A', table: 'sessionRuns', rowId: 'run-deleted',
    rev: 'remote-rev', status: 'pending_delete', deleted: 1,
  })
  await setMetaConflict({
    id: 'sessionRuns:run-deleted', table: 'sessionRuns', rowId: 'run-deleted',
    local: null,
    remote: {
      id: 'run-deleted', sessionId: 'session-1', date: '2026-10-08', poolName: 'North', poolLength: 25,
      notes: '', status: 'completed', sessionStartedAt: 100, sessionPausedAt: null, sessionPauseDuration: 0,
      createdAt: 'created', updatedAt: 'remote-rev',
    },
    localRev: 'local-rev', remoteRev: 'remote-rev',
  })
}

async function resolveConflict(
  id: string,
  resolution: 'local' | 'remote',
  transport?: SyncTransport,
): Promise<void> {
  syncService.setActiveOrg('org-A')
  await syncService.resolveConflict(id, resolution, transport)
}

describe('conflict resolution', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction('rw', [db.swimmers, db.sessionRuns, db._sync_meta], async () => {
      await db.swimmers.clear()
      await db.sessionRuns.clear()
      await db._sync_meta.clear()
    })
  })

  afterEach(() => {
    syncService.stop()
  })

  test("resolve 'remote' applies the cloud version and clears the conflict", async () => {
    await seedConflict('swimmers', 's1', { name: 'Local' }, { name: 'Server' }, 'old', 'new')
    await resolveConflict('org-A:swimmers:s1', 'remote')
    expect((await db.swimmers.get('s1'))?.name).toBe('Server')
    expect((await readSyncState('org-A')).conflicts).toHaveLength(0)
  })

  test("resolve 'local' re-pushes the local version", async () => {
    await seedConflict('swimmers', 's1', { name: 'Local' }, { name: 'Server' }, 'old', 'new')
    const transport = makeFakeTransport()
    await resolveConflict('org-A:swimmers:s1', 'local', transport)
    expect(transport.upserted.some((r) => r.payload.name === 'Local')).toBe(true)
  })

  test('resolves a history delete conflict to the remote row', async () => {
    await seedDeleteConflict()

    await resolveConflict('org-A:sessionRuns:run-deleted', 'remote')

    expect((await db.sessionRuns.get('run-deleted'))?.status).toBe('completed')
    expect((await db._sync_meta.get('sessionRuns:run-deleted'))?.deleted).toBe(0)
  })

  test('retries a local history tombstone against the latest revision', async () => {
    await seedDeleteConflict()
    const transport = makeFakeTransport()

    await resolveConflict('org-A:sessionRuns:run-deleted', 'local', transport)

    expect(transport.sent).toMatchObject([{ table: 'sessionRuns', id: 'run-deleted', op: 'delete', rev: 'remote-rev' }])
    expect((await db._sync_meta.get('sessionRuns:run-deleted'))?.deleted).toBe(1)
  })

  test('reports a failed local conflict resolution in sync state', async () => {
    await seedConflict('swimmers', 's1', { name: 'Local' }, { name: 'Server' }, 'old', 'new')
    const transport: SyncTransport = {
      ensurePersonalOrganization: async () => 'org-A',
      push: async () => { throw new Error('conflict retry failed') },
      pull: async () => ({ changes: [], nextCursors: { swimmers: '', sessions: '', drills: '', libraryDrills: '', sessionRuns: '', runDrills: '', runSwimmers: '', laps: '', laneDrillResults: '' } }),
    }

    await resolveConflict('org-A:swimmers:s1', 'local', transport)

    expect(syncService.getState().error?.message).toBe('conflict retry failed')
    expect(syncService.getState().phase).toBe('error')
  })
})
