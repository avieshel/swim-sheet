import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDao = vi.hoisted(() => ({
  getEquipmentOptions: vi.fn(),
  setEquipmentOptions: vi.fn(),
  estimateDbSize: vi.fn(),
  cleanupOldData: vi.fn(),
  exportDatabase: vi.fn(),
  importDatabase: vi.fn(),
  getBackupInfo: vi.fn(),
  getStoragePersistenceStatus: vi.fn(),
  requestStoragePersistence: vi.fn(),
  deleteAllSwimmers: vi.fn(),
  deleteAllSessions: vi.fn(),
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

  it('exportDatabase delegates to dao', async () => {
    mockDao.exportDatabase.mockResolvedValue('{}')
    const result = await settingsService.exportDatabase()
    expect(mockDao.exportDatabase).toHaveBeenCalledOnce()
    expect(result).toBe('{}')
  })

  it('importDatabase delegates to dao', async () => {
    mockDao.importDatabase.mockResolvedValue(undefined)
    await settingsService.importDatabase('{"tables":{}}')
    expect(mockDao.importDatabase).toHaveBeenCalledWith('{"tables":{}}')
  })

  it('getBackupInfo delegates to dao', async () => {
    mockDao.getBackupInfo.mockReturnValue({ savedAt: '2026-01-01T00:00:00.000Z' })
    const result = settingsService.getBackupInfo()
    expect(mockDao.getBackupInfo).toHaveBeenCalledOnce()
    expect(result?.savedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('getStoragePersistence delegates to dao', async () => {
    mockDao.getStoragePersistenceStatus.mockResolvedValue(true)
    const result = await settingsService.getStoragePersistence()
    expect(mockDao.getStoragePersistenceStatus).toHaveBeenCalledOnce()
    expect(result).toBe(true)
  })

  it('requestStoragePersistence delegates to dao', async () => {
    mockDao.requestStoragePersistence.mockResolvedValue(true)
    const result = await settingsService.requestStoragePersistence()
    expect(mockDao.requestStoragePersistence).toHaveBeenCalledOnce()
    expect(result).toBe(true)
  })

  it('deleteAllSwimmers delegates to dao', async () => {
    mockDao.deleteAllSwimmers.mockResolvedValue(undefined)
    await settingsService.deleteAllSwimmers()
    expect(mockDao.deleteAllSwimmers).toHaveBeenCalledOnce()
  })

  it('deleteAllSessions delegates to dao', async () => {
    mockDao.deleteAllSessions.mockResolvedValue(undefined)
    await settingsService.deleteAllSessions()
    expect(mockDao.deleteAllSessions).toHaveBeenCalledOnce()
  })

  it('exposes DEFAULT_EQUIPMENT', () => {
    expect(settingsService.DEFAULT_EQUIPMENT).toEqual(['fins', 'paddles'])
  })

  it('propagates errors from DAO', async () => {
    mockDao.getEquipmentOptions.mockRejectedValue(new Error('DB error'))
    await expect(settingsService.getEquipmentOptions()).rejects.toThrow('DB error')
  })
})
