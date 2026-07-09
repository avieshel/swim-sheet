import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SafeDrill, SafeLibraryDrill } from '../../db/schema'

const mockDao = vi.hoisted(() => ({
  getDrillsForSession: vi.fn(),
  getDrill: vi.fn(),
  addDrill: vi.fn(),
  updateDrill: vi.fn(),
  deleteDrill: vi.fn(),
  getAllLibraryDrills: vi.fn(),
  addLibraryDrill: vi.fn(),
  updateLibraryDrill: vi.fn(),
  deleteLibraryDrill: vi.fn(),
  seedLibraryDrills: vi.fn(),
  patchLibraryDrills: vi.fn(),
  resetLibraryToDefaults: vi.fn(),
}))

vi.mock('../../db/dao', () => mockDao)

const { drillService } = await import('../drillService')

describe('drillService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('template drills', () => {
    it('getForSession calls getDrillsForSession with sessionId', async () => {
      const expected = [{ id: 'd1', name: 'Drill 1' }]
      mockDao.getDrillsForSession.mockResolvedValue(expected)
      const result = await drillService.getForSession('s1')
      expect(mockDao.getDrillsForSession).toHaveBeenCalledExactlyOnceWith('s1')
      expect(result).toEqual(expected)
    })

    it('get calls getDrill with id', async () => {
      const expected = { id: 'd1', name: 'Drill 1' }
      mockDao.getDrill.mockResolvedValue(expected)
      const result = await drillService.get('d1')
      expect(mockDao.getDrill).toHaveBeenCalledExactlyOnceWith('d1')
      expect(result).toEqual(expected)
    })

    it('create calls addDrill with data', async () => {
      const data: SafeDrill = { session_id: 's1', name: 'New Drill', stroke: 'freestyle', distance: 100, order: 0, items: [], repeatCount: 0, timingMode: 'individual', focus: 'none', labels: [], description: '' }
      mockDao.addDrill.mockResolvedValue('new-id')
      const result = await drillService.create(data)
      expect(mockDao.addDrill).toHaveBeenCalledExactlyOnceWith(data)
      expect(result).toBe('new-id')
    })

    it('update calls updateDrill with id and data', async () => {
      const data = { name: 'Updated Drill' }
      mockDao.updateDrill.mockResolvedValue(undefined)
      await drillService.update('d1', data)
      expect(mockDao.updateDrill).toHaveBeenCalledExactlyOnceWith('d1', data)
    })

    it('delete calls deleteDrill with id', async () => {
      mockDao.deleteDrill.mockResolvedValue(undefined)
      await drillService.delete('d1')
      expect(mockDao.deleteDrill).toHaveBeenCalledExactlyOnceWith('d1')
    })
  })

  describe('library drills', () => {
    it('listLibrary calls getAllLibraryDrills', async () => {
      const expected = [{ id: 'l1', name: 'Library Drill' }]
      mockDao.getAllLibraryDrills.mockResolvedValue(expected)
      const result = await drillService.listLibrary()
      expect(mockDao.getAllLibraryDrills).toHaveBeenCalledOnce()
      expect(result).toEqual(expected)
    })

    it('createLibrary calls addLibraryDrill with data', async () => {
      const data: SafeLibraryDrill = { name: 'New Lib Drill', stroke: 'freestyle', distance: 100 }
      mockDao.addLibraryDrill.mockResolvedValue('new-id')
      const result = await drillService.createLibrary(data)
      expect(mockDao.addLibraryDrill).toHaveBeenCalledExactlyOnceWith(data)
      expect(result).toBe('new-id')
    })

    it('updateLibrary calls updateLibraryDrill with id and data', async () => {
      const data = { name: 'Updated Lib Drill' }
      mockDao.updateLibraryDrill.mockResolvedValue(undefined)
      await drillService.updateLibrary('l1', data)
      expect(mockDao.updateLibraryDrill).toHaveBeenCalledExactlyOnceWith('l1', data)
    })

    it('deleteLibrary calls deleteLibraryDrill with id', async () => {
      mockDao.deleteLibraryDrill.mockResolvedValue(undefined)
      await drillService.deleteLibrary('l1')
      expect(mockDao.deleteLibraryDrill).toHaveBeenCalledExactlyOnceWith('l1')
    })
  })

  describe('utilities', () => {
    it('patchLibrary calls patchLibraryDrills', async () => {
      mockDao.patchLibraryDrills.mockResolvedValue(undefined)
      await drillService.patchLibrary()
      expect(mockDao.patchLibraryDrills).toHaveBeenCalledOnce()
    })

    it('resetLibraryToDefaults calls resetLibraryToDefaults', async () => {
      mockDao.resetLibraryToDefaults.mockResolvedValue(undefined)
      await drillService.resetLibraryToDefaults()
      expect(mockDao.resetLibraryToDefaults).toHaveBeenCalledOnce()
    })

    it('seedLibrary calls seedLibraryDrills', async () => {
      mockDao.seedLibraryDrills.mockResolvedValue(undefined)
      await drillService.seedLibrary()
      expect(mockDao.seedLibraryDrills).toHaveBeenCalledOnce()
    })
  })

  it('propagates errors from DAO', async () => {
    mockDao.getAllLibraryDrills.mockRejectedValue(new Error('DB error'))
    await expect(drillService.listLibrary()).rejects.toThrow('DB error')
  })
})
