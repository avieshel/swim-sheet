import 'fake-indexeddb/auto'
import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import { db } from '../../db/schema'
import { syncService } from '../syncService'
import type {
  SyncTransport,
  CloudChange,
  LocalChange,
  FirstMergeSummary,
  SyncResult,
} from '../types'
import { makeFakeTransport } from './syncTestUtils'

type CloudRow = { id: string; catalogKey?: string; name: string; updated_at: string }

function fakeTransportWithCloud(rows: CloudRow[]): SyncTransport & { upserted: LocalChange[] } {
  const changes: CloudChange[] = rows.map((r) => ({
    table: 'sessions',
    id: r.id,
    op: 'upsert',
    payload: {
      id: r.id,
      name: r.name,
      catalogKey: r.catalogKey,
      notes: '',
      createdAt: r.updated_at,
      updatedAt: r.updated_at,
    },
    catalogKey: r.catalogKey,
    updatedAt: r.updated_at,
    deletedAt: null,
  }))
  return makeFakeTransport({
    pull: async (_orgId, _cursors, tables) => ({
      changes: changes.filter((change) => !tables || tables.includes(change.table)),
      nextCursors: {
        swimmers: 'tc',
        sessions: 'tc',
        drills: 'tc',
        libraryDrills: 'tc',
        sessionRuns: 'tc',
        runDrills: 'tc',
        runSwimmers: 'tc',
        laps: 'tc',
        laneDrillResults: 'tc',
      },
    }),
  }) as SyncTransport & { upserted: LocalChange[] }
}

async function previewFirstMerge(transport: SyncTransport, orgId: string): Promise<FirstMergeSummary> {
  syncService.init(transport, { autoSync: false })
  syncService.setActiveOrg(orgId)
  return syncService.previewFirstMerge(transport, orgId)
}

async function confirmFirstMerge(transport: SyncTransport, orgId: string): Promise<SyncResult> {
  syncService.init(transport, { autoSync: false })
  syncService.setActiveOrg(orgId)
  return syncService.confirmFirstMerge(transport, orgId)
}

describe('first merge', () => {
  beforeEach(async () => {
    await db.open()
    await db.transaction('rw', [db.sessions, db.drills, db._sync_meta, db._sync_cursor], async () => {
      await db.sessions.clear()
      await db.drills.clear()
      await db._sync_meta.clear()
      await db._sync_cursor.clear()
    })
  })

  afterEach(() => {
    syncService.stop()
  })

  test('reconciles duplicate starter sessions by catalogKey into one cloud row', async () => {
    await db.sessions.add({
      id: 'local-1',
      name: 'Distance Progression',
      catalogKey: 'cat-distance',
      notes: '',
      createdAt: 't',
      updatedAt: 't',
    })
    const transport = fakeTransportWithCloud([
      { id: 'cloud-1', catalogKey: 'cat-distance', name: 'Distance Progression', updated_at: 'tc' },
    ])
    const summary = await previewFirstMerge(transport, 'org-A')
    expect(summary.catalogMatches).toBeGreaterThanOrEqual(1)
    const result = await confirmFirstMerge(transport, 'org-A')
    const pushedCatalogRows = transport.upserted.filter((r) => r.payload?.catalogKey === 'cat-distance')
    expect(pushedCatalogRows).toHaveLength(1)
    expect(result.error).toBeUndefined()
  })

  test('pushes local-only rows when there is no cloud match', async () => {
    await db.sessions.add({
      id: 'local-2',
      name: 'My Custom Session',
      notes: '',
      createdAt: 't',
      updatedAt: 't',
    })
    const transport = fakeTransportWithCloud([])
    const result = await confirmFirstMerge(transport, 'org-A')
    expect(result.pushed).toBeGreaterThanOrEqual(1)
    const pushedWithoutCatalog = transport.upserted.filter(
      (r) => r.payload?.catalogKey === undefined || r.payload?.catalogKey === null,
    )
    expect(pushedWithoutCatalog.length).toBeGreaterThanOrEqual(1)
  })
})
