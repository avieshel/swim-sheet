import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import type { Drill, Session } from '../../db/schema'
import { defaultSessionPackageConfig } from '../../../../shared/sessionPackage/config'
import type { SessionPackageV1 } from '../../../../shared/sessionPackage/types'
import {
  exportSessionPackage,
  importSessionPackage,
  inspectSessionPackage,
} from '../sessionPackageService'

const createdAt = '2026-10-21T12:00:00.000Z'

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 'source-session',
    name: 'Source Set',
    notes: 'Aerobic technique',
    visibility: 'organization',
    assignedTo: 'coach-1',
    catalogKey: 'source-catalog',
    aiDraftStatus: 'unreviewed',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

function drill(overrides: Partial<Drill> = {}): Drill {
  return {
    id: 'source-drill',
    sessionId: 'source-session',
    libraryDrillId: 'library-id',
    name: 'IM transitions',
    stroke: 'im',
    distance: 200,
    order: 0,
    items: [
      {
        id: 'source-item',
        distance: 50,
        stroke: 'butterfly',
        repeatCount: 2,
        intensity: 'v3',
        interval: 'descend as able',
        equipment: ['custom fins'],
        segments: [{ name: 'Underwater', distance: 10, stroke: 'freestyle' }],
      },
    ],
    repeatCount: 1,
    timingMode: 'individual',
    focus: 'fitness',
    labels: ['aerobic'],
    description: 'Work the transition.',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

function packageFixture(overrides: Partial<SessionPackageV1> = {}): SessionPackageV1 {
  return {
    format: 'swimsheet-session',
    version: 1,
    exportedAt: createdAt,
    creator: { label: 'Coach A' },
    session: { name: 'Imported Set', notes: 'Aerobic technique' },
    drills: [
      {
        name: 'IM transitions',
        stroke: 'im',
        distance: 200,
        order: 0,
        items: [
          {
            distance: 50,
            stroke: 'butterfly',
            repeatCount: 2,
            intensity: 'v3',
            interval: 'descend as able',
            equipment: ['custom fins'],
            segments: [{ name: 'Underwater', distance: 10, stroke: 'freestyle' }],
          },
        ],
        repeatCount: 1,
        timingMode: 'individual',
        focus: 'fitness',
        labels: ['aerobic'],
        description: 'Work the transition.',
      },
    ],
    ...overrides,
  }
}

async function clearTables(): Promise<void> {
  await Promise.all([db.sessions.clear(), db.drills.clear(), db.libraryDrills.clear()])
}

beforeEach(async () => {
  if (!db.isOpen()) await db.open()
  await clearTables()
})

describe('session package service export', () => {
  it('maps authored fields and sorts drills by order', async () => {
    await db.sessions.add(session())
    await db.drills.bulkAdd([
      drill({ id: 'later', name: 'Later', order: 1 }),
      drill({ id: 'earlier', name: 'Earlier', order: 0 }),
    ])

    const result = await exportSessionPackage('source-session')

    expect(result).toMatchObject({
      format: 'swimsheet-session',
      version: 1,
      session: { name: 'Source Set', notes: 'Aerobic technique' },
      drills: [
        {
          name: 'Earlier',
          order: 0,
          items: [{ distance: 50, equipment: ['custom fins'], segments: [{ name: 'Underwater' }] }],
        },
        { name: 'Later', order: 1 },
      ],
    })
    expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('omits database IDs, ownership, and local-only markers', async () => {
    await db.sessions.add(session())
    await db.drills.add(drill())

    const result = await exportSessionPackage('source-session')

    expect(result).not.toHaveProperty('id')
    expect(result.session).not.toHaveProperty('visibility')
    expect(result.session).not.toHaveProperty('assignedTo')
    expect(result.session).not.toHaveProperty('catalogKey')
    expect(result.session).not.toHaveProperty('aiDraftStatus')
    expect(result.drills[0]).not.toHaveProperty('id')
    expect(result.drills[0]).not.toHaveProperty('sessionId')
    expect(result.drills[0]).not.toHaveProperty('libraryDrillId')
    expect(result.drills[0].items[0]).not.toHaveProperty('id')
  })

  it('rejects source content that cannot be represented by the package', async () => {
    await db.sessions.add(session())
    await db.drills.add(drill({ distance: defaultSessionPackageConfig.limits.maxDistance + 1 }))

    await expect(exportSessionPackage('source-session')).rejects.toThrow()
  })
})

describe('session package service inspection', () => {
  it('rejects an invalid package without writing local rows', async () => {
    const invalid = { format: 'wrong', version: 1 }

    const result = await inspectSessionPackage(invalid)

    expect(result).toMatchObject({ outcome: 'invalid' })
    expect(await db.sessions.count()).toBe(0)
    expect(await db.drills.count()).toBe(0)
  })

  it('finds a trimmed case-insensitive name conflict', async () => {
    await db.sessions.add(session({ name: '  Pool Set  ' }))

    const result = await inspectSessionPackage(packageFixture({
      session: { name: 'pool set', notes: '' },
    }))

    expect(result).toMatchObject({
      outcome: 'ready',
      nameConflict: true,
      suggestedName: 'pool set (imported)',
    })
  })

  it('suggests an unused numbered name within the package name limit', async () => {
    await db.sessions.bulkAdd([
      session({ id: 'source-set', name: 'Set' }),
      session({ id: 'copy-1', name: 'Set (imported)' }),
      session({ id: 'copy-2', name: 'Set (imported 2)' }),
    ])

    const result = await inspectSessionPackage(packageFixture({
      session: { name: 'Set', notes: '' },
    }))

    expect(result).toMatchObject({ outcome: 'ready', suggestedName: 'Set (imported 3)' })

    const longName = 'S'.repeat(defaultSessionPackageConfig.limits.maxNameLength)
    await db.sessions.add(session({ id: 'long-source', name: longName }))
    const longResult = await inspectSessionPackage(packageFixture({
      session: { name: longName, notes: '' },
    }))
    if (longResult.outcome !== 'ready' || !longResult.suggestedName) {
      throw new Error('expected a suggested import name')
    }
    expect(longResult.suggestedName.length).toBeLessThanOrEqual(defaultSessionPackageConfig.limits.maxNameLength)
    expect(longResult.suggestedName.endsWith(' (imported)')).toBe(true)
  })
})

describe('session package service import', () => {
  it('creates a private owned copy with fresh session, drill, and item IDs', async () => {
    const result = await importSessionPackage(packageFixture(), 'My Copy')

    expect(result.outcome).toBe('created')
    if (result.outcome !== 'created') throw new Error('expected imported session')
    const imported = await db.sessions.get(result.sessionId)
    const drills = await db.drills.where('sessionId').equals(result.sessionId).toArray()
    expect(imported).toMatchObject({ name: 'My Copy', notes: 'Aerobic technique', visibility: 'private', assignedTo: null })
    expect(result.sessionId).not.toBe('source-session')
    expect(drills).toHaveLength(1)
    expect(drills[0].id).not.toBe('source-drill')
    expect(drills[0].items[0].id).not.toBe('source-item')
    expect(drills[0]).toMatchObject({ name: 'IM transitions', order: 0 })
    expect(drills[0]).not.toHaveProperty('libraryDrillId')
    expect(drills[0].items[0]).toMatchObject({
      intensity: 'v3',
      interval: 'descend as able',
      equipment: ['custom fins'],
      segments: [{ name: 'Underwater', distance: 10, stroke: 'freestyle' }],
    })
  })

  it('preserves empty templates and rich drill fields', async () => {
    const empty = packageFixture({ session: { name: 'Empty Template', notes: '' }, drills: [] })
    const emptyResult = await importSessionPackage(empty, 'Empty Template')
    const rich = packageFixture()
    rich.drills[0].items = []
    const richResult = await importSessionPackage(rich, 'Rich Empty Drill')

    expect(emptyResult.outcome).toBe('created')
    expect(richResult.outcome).toBe('created')
    if (richResult.outcome !== 'created') throw new Error('expected imported drill session')
    expect(await db.drills.where('sessionId').equals(richResult.sessionId).first()).toMatchObject({ items: [] })
  })

  it('does not write imported drills to the drill bank', async () => {
    const result = await importSessionPackage(packageFixture(), 'No Library Copy')

    expect(result.outcome).toBe('created')
    expect(await db.libraryDrills.count()).toBe(0)
  })

  it('rolls back session and drills if a drill insert fails', async () => {
    const addDrill = vi.spyOn(db.drills, 'add').mockRejectedValueOnce(new Error('storage failed'))

    await expect(importSessionPackage(packageFixture(), 'Rollback Copy')).rejects.toThrow('storage failed')

    expect(await db.sessions.count()).toBe(0)
    expect(await db.drills.count()).toBe(0)
    expect(await db.libraryDrills.count()).toBe(0)
    addDrill.mockRestore()
  })
})
