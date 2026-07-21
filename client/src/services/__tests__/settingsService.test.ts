import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDao = vi.hoisted(() => ({
  getEquipmentOptions: vi.fn(),
  setEquipmentOptions: vi.fn(),
  estimateDbSize: vi.fn(),
  cleanupOldData: vi.fn(),
  deleteAllData: vi.fn(),
  DEFAULT_EQUIPMENT: ['fins', 'paddles'],
}))

vi.mock('../../db/dao', () => mockDao)

const { settingsService } = await import('../settingsService')

describe('settingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getEquipmentOptions delegates to dao', async () => {
    const expected = ['fins', 'paddles']
    mockDao.getEquipmentOptions.mockResolvedValue(expected)
    const result = await settingsService.getEquipmentOptions()
    expect(mockDao.getEquipmentOptions).toHaveBeenCalledOnce()
    expect(result).toEqual(expected)
  })

  it('setEquipmentOptions delegates to dao', async () => {
    mockDao.setEquipmentOptions.mockResolvedValue(undefined)
    await settingsService.setEquipmentOptions(['fins'])
    expect(mockDao.setEquipmentOptions).toHaveBeenCalledWith(['fins'])
  })

  it('estimateDbSize delegates to dao', async () => {
    mockDao.estimateDbSize.mockResolvedValue(1024)
    const result = await settingsService.estimateDbSize()
    expect(mockDao.estimateDbSize).toHaveBeenCalledOnce()
    expect(result).toBe(1024)
  })

  it('cleanupOldData delegates to dao', async () => {
    mockDao.cleanupOldData.mockResolvedValue(undefined)
    await settingsService.cleanupOldData(30)
    expect(mockDao.cleanupOldData).toHaveBeenCalledWith(30)
  })

  it('deleteAllData delegates to dao', async () => {
    mockDao.deleteAllData.mockResolvedValue(undefined)
    await settingsService.deleteAllData()
    expect(mockDao.deleteAllData).toHaveBeenCalledOnce()
  })

  it('exposes DEFAULT_EQUIPMENT', () => {
    expect(settingsService.DEFAULT_EQUIPMENT).toEqual(['fins', 'paddles'])
  })

  it('propagates errors from DAO', async () => {
    mockDao.getEquipmentOptions.mockRejectedValue(new Error('DB error'))
    await expect(settingsService.getEquipmentOptions()).rejects.toThrow('DB error')
  })
})
