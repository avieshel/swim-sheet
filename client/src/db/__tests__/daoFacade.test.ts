import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import * as dao from '../dao'
import * as adminDao from '../adminDao'
import { configureCoachAssist, isCoachAssistMode } from '../adminDao'
import { db } from '../schema'

describe('dao facade — coach-assist delegation', () => {
  const sessionSpy = vi.spyOn(adminDao, 'getAllSessions')
  const addDrillSpy = vi.spyOn(adminDao, 'addDrill')
  const libSpy = vi.spyOn(adminDao, 'getAllLibraryDrills')
  const getDrillSpy = vi.spyOn(adminDao, 'getDrill')
  const dexieDrillsSpy = vi.spyOn(db.drills, 'add')

  beforeEach(() => {
    configureCoachAssist({ userId: 'c1', orgId: 'o1' })
    sessionSpy.mockResolvedValue([{ id: 'admin-s' } as never])
    addDrillSpy.mockResolvedValue('admin-d')
    libSpy.mockResolvedValue([{ id: 'admin-l' } as never])
    getDrillSpy.mockResolvedValue({ id: 'admin-d' } as never)
    dexieDrillsSpy.mockResolvedValue('')
  })

  afterEach(() => {
    configureCoachAssist(null)
    vi.clearAllMocks()
  })

  it('in coach mode, getAllSessions delegates to adminDao and not Dexie', async () => {
    const result = await dao.getAllSessions()
    expect(sessionSpy).toHaveBeenCalledOnce()
    expect(result).toEqual([{ id: 'admin-s' }])
  })

  it('in coach mode, addDrill delegates to adminDao and not Dexie', async () => {
    await dao.addDrill({ sessionId: 's1', name: 'A' } as never)
    expect(addDrillSpy).toHaveBeenCalledOnce()
    expect(dexieDrillsSpy).not.toHaveBeenCalled()
  })

  it('in coach mode, getAllLibraryDrills delegates to adminDao', async () => {
    const result = await dao.getAllLibraryDrills()
    expect(libSpy).toHaveBeenCalledOnce()
    expect(result).toEqual([{ id: 'admin-l' }])
  })

  it('in coach mode, getDrill delegates to adminDao', async () => {
    const result = await dao.getDrill('x')
    expect(getDrillSpy).toHaveBeenCalledWith('x')
    expect(result).toEqual({ id: 'admin-d' })
  })

  it('in local mode, getAllSessions reads Dexie and skips adminDao', async () => {
    configureCoachAssist(null)
    expect(isCoachAssistMode()).toBe(false)
    const result = await dao.getAllSessions()
    expect(sessionSpy).not.toHaveBeenCalled()
    expect(Array.isArray(result)).toBe(true)
  })
})
