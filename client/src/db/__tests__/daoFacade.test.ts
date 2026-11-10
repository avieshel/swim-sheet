import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import * as dao from '../dao'
import * as adminDao from '../adminDao'
import { configureCoachAssist, isCoachAssistMode, setAdminService } from '../adminDao'
import { db } from '../schema'

describe('dao facade — coach-assist delegation', () => {
  const sessionSpy = vi.spyOn(adminDao, 'getAllSessions')
  const addSessionSpy = vi.spyOn(adminDao, 'addSession')
  const addDrillSpy = vi.spyOn(adminDao, 'addDrill')
  const libSpy = vi.spyOn(adminDao, 'getAllLibraryDrills')
  const getDrillSpy = vi.spyOn(adminDao, 'getDrill')
  const dexieSessionsAddSpy = vi.spyOn(db.sessions, 'add')
  const dexieDrillsSpy = vi.spyOn(db.drills, 'add')
  const bundleWrite = vi.fn(async () => ({
    outcome: 'created',
    sessionId: 'admin-s-id',
    drillIds: ['admin-d1', 'admin-d2'],
  }))
  const packageWrite = vi.fn(async () => ({
    outcome: 'created',
    sessionId: 'imported-s-id',
    drillIds: ['imported-d1'],
  }))

  beforeEach(() => {
    configureCoachAssist({ userId: 'c1', orgId: 'o1' })
    sessionSpy.mockResolvedValue([{ id: 'admin-s' } as never])
    addSessionSpy.mockResolvedValue('admin-row')
    addDrillSpy.mockResolvedValue('admin-row')
    libSpy.mockResolvedValue([{ id: 'admin-l' } as never])
    getDrillSpy.mockResolvedValue({ id: 'admin-d' } as never)
    dexieSessionsAddSpy.mockResolvedValue('')
    dexieDrillsSpy.mockResolvedValue('')
    setAdminService({
      getCoachData: vi.fn(async () => ({ sessions: [], drills: [], swimmers: [], libraryDrills: [] })),
      adminCreate: vi.fn(async () => 'admin-row'),
      adminUpdate: vi.fn(async () => {}),
      adminDelete: vi.fn(async () => {}),
      adminCreateSessionBundle: bundleWrite,
      adminImportSessionPackage: packageWrite,
    } as never)
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

  it('in coach mode, addSessionWithDrills delegates to one admin bundle write', async () => {
    const id = await dao.addSessionWithDrills(
      { name: 'AI Session' } as never,
      [{ name: 'D1' }, { name: 'D2' }] as never,
    )
    expect(bundleWrite).toHaveBeenCalledOnce()
    expect(addSessionSpy).not.toHaveBeenCalled()
    expect(addDrillSpy).not.toHaveBeenCalled()
    expect(dexieSessionsAddSpy).not.toHaveBeenCalled()
    expect(dexieDrillsSpy).not.toHaveBeenCalled()
    expect(id).toBe('admin-s-id')
  })

  it('in coach mode, package import delegates to admin DAO and never Dexie', async () => {
    const importPackage = Reflect.get(dao, 'addImportedSessionWithDrillsIf') as (
      packageValue: unknown,
      session: Record<string, unknown>,
      drills: Array<Record<string, unknown>>,
      canCreate: (existingSessions: Array<{ name: string }>) => boolean,
    ) => Promise<string | null>
    expect(typeof importPackage).toBe('function')
    const id = await importPackage(
      { format: 'swimsheet-session', version: 1 } as never,
      { name: 'Imported' } as never,
      [{ name: 'D1' }] as never,
      () => true,
    )
    expect(packageWrite).toHaveBeenCalledOnce()
    expect(bundleWrite).not.toHaveBeenCalled()
    expect(addSessionSpy).not.toHaveBeenCalled()
    expect(addDrillSpy).not.toHaveBeenCalled()
    expect(dexieSessionsAddSpy).not.toHaveBeenCalled()
    expect(dexieDrillsSpy).not.toHaveBeenCalled()
    expect(id).toBe('imported-s-id')
  })

  it('in local mode, addSessionWithDrills writes Dexie and skips adminDao', async () => {
    configureCoachAssist(null)
    expect(isCoachAssistMode()).toBe(false)
    const result = await dao.addSessionWithDrills(
      { name: 'Local Session' } as never,
      [{ name: 'D1' }] as never,
    )
    expect(bundleWrite).not.toHaveBeenCalled()
    expect(packageWrite).not.toHaveBeenCalled()
    expect(addSessionSpy).not.toHaveBeenCalled()
    expect(addDrillSpy).not.toHaveBeenCalled()
    expect(typeof result).toBe('string')
    expect(dexieSessionsAddSpy).toHaveBeenCalledOnce()
    expect(dexieDrillsSpy).toHaveBeenCalledOnce()
  })

  it('in local mode, getAllSessions reads Dexie and skips adminDao', async () => {
    configureCoachAssist(null)
    expect(isCoachAssistMode()).toBe(false)
    const result = await dao.getAllSessions()
    expect(sessionSpy).not.toHaveBeenCalled()
    expect(Array.isArray(result)).toBe(true)
  })
})
