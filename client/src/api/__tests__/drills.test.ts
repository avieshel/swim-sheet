import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../services/drillService', () => ({
  drillService: {
    getDrills: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listLibrary: vi.fn(),
    createLibrary: vi.fn(),
    updateLibrary: vi.fn(),
    deleteLibrary: vi.fn(),
    patchLibrary: vi.fn(),
    resetLibraryToDefaults: vi.fn(),
    seedLibrary: vi.fn(),
  },
}))

import { getSessionDrills, getDrill, createDrill, updateDrill, deleteDrill, listLibraryDrills, createLibraryDrill, updateLibraryDrill, deleteLibraryDrill, patchLibraryDrills, resetLibraryToDefaults, seedLibraryDrills } from '../drills'
import { drillService } from '../../services/drillService'

describe('drills API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getSessionDrills delegates to drillService.getDrills', async () => {
    const expected = [{ id: 'd1', sessionId: 's1' }]
    vi.mocked(drillService.getDrills).mockResolvedValue(expected)
    const result = await getSessionDrills('s1')
    expect(drillService.getDrills).toHaveBeenCalledWith('s1')
    expect(result).toBe(expected)
  })

  it('getDrill delegates to drillService.get', async () => {
    const expected = { id: 'd1' }
    vi.mocked(drillService.get).mockResolvedValue(expected)
    const result = await getDrill('d1')
    expect(drillService.get).toHaveBeenCalledWith('d1')
    expect(result).toBe(expected)
  })

  it('createDrill delegates to drillService.create', async () => {
    const data = { sessionId: 's1', name: 'Test', distance: 100, stroke: 'freestyle' as const, order: 0 }
    vi.mocked(drillService.create).mockResolvedValue('new-id')
    const result = await createDrill(data)
    expect(drillService.create).toHaveBeenCalledWith(data)
    expect(result).toBe('new-id')
  })

  it('updateDrill delegates to drillService.update', async () => {
    const data = { name: 'Updated' }
    vi.mocked(drillService.update).mockResolvedValue(undefined)
    await updateDrill('d1', data)
    expect(drillService.update).toHaveBeenCalledWith('d1', data)
  })

  it('deleteDrill delegates to drillService.delete', async () => {
    vi.mocked(drillService.delete).mockResolvedValue(undefined)
    await deleteDrill('d1')
    expect(drillService.delete).toHaveBeenCalledWith('d1')
  })

  it('listLibraryDrills delegates to drillService.listLibrary', async () => {
    const expected = [{ id: 'ld1' }]
    vi.mocked(drillService.listLibrary).mockResolvedValue(expected)
    const result = await listLibraryDrills()
    expect(drillService.listLibrary).toHaveBeenCalledOnce()
    expect(result).toBe(expected)
  })

  it('createLibraryDrill delegates to drillService.createLibrary', async () => {
    const data = { name: 'Lib Drill', stroke: 'freestyle' as const, distance: 50 }
    vi.mocked(drillService.createLibrary).mockResolvedValue('new-id')
    const result = await createLibraryDrill(data)
    expect(drillService.createLibrary).toHaveBeenCalledWith(data)
    expect(result).toBe('new-id')
  })

  it('updateLibraryDrill delegates to drillService.updateLibrary', async () => {
    const data = { name: 'Updated Lib' }
    vi.mocked(drillService.updateLibrary).mockResolvedValue(undefined)
    await updateLibraryDrill('ld1', data)
    expect(drillService.updateLibrary).toHaveBeenCalledWith('ld1', data)
  })

  it('deleteLibraryDrill delegates to drillService.deleteLibrary', async () => {
    vi.mocked(drillService.deleteLibrary).mockResolvedValue(undefined)
    await deleteLibraryDrill('ld1')
    expect(drillService.deleteLibrary).toHaveBeenCalledWith('ld1')
  })

  it('patchLibraryDrills delegates to drillService.patchLibrary', async () => {
    vi.mocked(drillService.patchLibrary).mockResolvedValue(undefined)
    await patchLibraryDrills()
    expect(drillService.patchLibrary).toHaveBeenCalledOnce()
  })

  it('resetLibraryToDefaults delegates to drillService.resetLibraryToDefaults', async () => {
    vi.mocked(drillService.resetLibraryToDefaults).mockResolvedValue(undefined)
    await resetLibraryToDefaults()
    expect(drillService.resetLibraryToDefaults).toHaveBeenCalledOnce()
  })

  it('seedLibraryDrills delegates to drillService.seedLibrary', async () => {
    vi.mocked(drillService.seedLibrary).mockResolvedValue(undefined)
    await seedLibraryDrills()
    expect(drillService.seedLibrary).toHaveBeenCalledOnce()
  })
})
