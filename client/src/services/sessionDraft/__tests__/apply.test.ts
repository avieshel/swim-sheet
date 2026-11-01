import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../../db/schema'
import { applySessionDraft, mapDraftToSessionAndDrills } from '../apply'
import type { SessionDraftV1 } from '../../../../../shared/sessionDraft/types'

const draft: SessionDraftV1 = {
  schemaVersion: 1,
  session: { name: 'Aerobic Set' },
  drills: [
    {
      name: 'Main',
      repeatCount: 2,
      items: [
        { distance: 100, stroke: 'freestyle', repeatCount: 3, intensity: 'v2', interval: '1:30', equipment: ['fins'] },
        { distance: 50, stroke: 'butterfly', repeatCount: 4, intensity: 'v4' },
      ],
    },
  ],
}

beforeEach(async () => {
  await db.sessions.clear()
  await db.drills.clear()
  await db.libraryDrills.clear()
})

describe('mapDraftToSessionAndDrills', () => {
  it('derives distance and distance-weighted dominant stroke', () => {
    const { drills } = mapDraftToSessionAndDrills(draft)
    // (100*3 + 50*4) * 2 = 1000
    expect(drills[0].distance).toBe(1000)
    // freestyle weight 300 > butterfly 200
    expect(drills[0].stroke).toBe('freestyle')
  })

  it('preserves all supported item fields', () => {
    const { drills } = mapDraftToSessionAndDrills(draft)
    const item = drills[0].items[0]
    expect(item.intensity).toBe('v2')
    expect(item.interval).toBe('1:30')
    expect(item.equipment).toEqual(['fins'])
    expect(item.segments).toBeUndefined()
  })

  it('supplies neutral app defaults', () => {
    const { drills, session } = mapDraftToSessionAndDrills(draft)
    expect(drills[0].focus).toBe('none')
    expect(drills[0].labels).toEqual([])
    expect(drills[0].description).toBe('')
    expect(session.notes).toBe('')
  })

  it('saves a normal template without the unreviewed marker', () => {
    expect(mapDraftToSessionAndDrills(draft).session.aiDraftStatus).toBeUndefined()
  })

  it('generates an id for every item', () => {
    const { drills } = mapDraftToSessionAndDrills(draft)
    expect(drills[0].items.every((i) => typeof i.id === 'string' && i.id.length > 0)).toBe(true)
  })
})

describe('applySessionDraft', () => {
  it('creates a session and drills, returns created, and writes no library drills', async () => {
    const res = await applySessionDraft(draft)
    expect(res.outcome).toBe('created')
    if (res.outcome === 'created') {
      const session = await db.sessions.get(res.sessionId)
      expect(session?.aiDraftStatus).toBeUndefined()
      const drills = await db.drills.where('sessionId').equals(res.sessionId).toArray()
      expect(drills).toHaveLength(1)
      expect(drills[0].items[0].equipment).toEqual(['fins'])
      expect(drills[0].items[0].segments).toBeUndefined()
    }
    expect(await db.libraryDrills.count()).toBe(0)
  })

  it('returns invalid for a bad draft and writes nothing', async () => {
    const res = await applySessionDraft({ schemaVersion: 2 })
    expect(res.outcome).toBe('invalid')
    expect(await db.sessions.count()).toBe(0)
  })

  it('rolls back and writes nothing on a storage failure', async () => {
    const spy = vi.spyOn(db.drills, 'add').mockRejectedValueOnce(new Error('boom'))
    await expect(applySessionDraft(draft)).rejects.toThrow('boom')
    expect(await db.sessions.count()).toBe(0)
    expect(await db.drills.count()).toBe(0)
    expect(await db.libraryDrills.count()).toBe(0)
    spy.mockRestore()
  })

  it('creates a new session for every save, like a manual template', async () => {
    const first = await applySessionDraft(draft)
    const second = await applySessionDraft(draft)
    expect(first.outcome).toBe('created')
    expect(second.outcome).toBe('created')
    if (first.outcome === 'created' && second.outcome === 'created') {
      expect(first.sessionId).not.toBe(second.sessionId)
    }
    expect(await db.sessions.count()).toBe(2)
  })
})
