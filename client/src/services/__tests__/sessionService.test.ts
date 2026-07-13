import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDao = vi.hoisted(() => ({
  getAllSessions: vi.fn(),
  getSession: vi.fn(),
  addSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  getDrillsForSession: vi.fn(),
  getCompletedRuns: vi.fn(),
  getActiveRun: vi.fn(),
}))

vi.mock('../../db/dao', () => mockDao)

const { sessionService } = await import('../sessionService')

describe('sessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list calls getAllSessions', async () => {
    const expected = [{ id: '1', name: 'Session 1' }]
    mockDao.getAllSessions.mockResolvedValue(expected)
    const result = await sessionService.list()
    expect(mockDao.getAllSessions).toHaveBeenCalledOnce()
    expect(result).toEqual(expected)
  })

  it('get calls getSession with id', async () => {
    const expected = { id: '1', name: 'Session 1' }
    mockDao.getSession.mockResolvedValue(expected)
    const result = await sessionService.get('1')
    expect(mockDao.getSession).toHaveBeenCalledExactlyOnceWith('1')
    expect(result).toEqual(expected)
  })

  it('create calls addSession with data', async () => {
    const data = { name: 'New Session', poolLength: 25, notes: '' }
    mockDao.addSession.mockResolvedValue('new-id')
    const result = await sessionService.create(data)
    expect(mockDao.addSession).toHaveBeenCalledExactlyOnceWith(data)
    expect(result).toBe('new-id')
  })

  it('update calls updateSession with id and data', async () => {
    const data = { name: 'Updated' }
    mockDao.updateSession.mockResolvedValue(undefined)
    await sessionService.update('1', data)
    expect(mockDao.updateSession).toHaveBeenCalledExactlyOnceWith('1', data)
  })

  it('delete calls deleteSession with id', async () => {
    mockDao.deleteSession.mockResolvedValue(undefined)
    await sessionService.delete('1')
    expect(mockDao.deleteSession).toHaveBeenCalledExactlyOnceWith('1')
  })

  it('getDrills calls getDrillsForSession with sessionId', async () => {
    const expected = [{ id: 'd1', name: 'Drill 1' }]
    mockDao.getDrillsForSession.mockResolvedValue(expected)
    const result = await sessionService.getDrills('1')
    expect(mockDao.getDrillsForSession).toHaveBeenCalledExactlyOnceWith('1')
    expect(result).toEqual(expected)
  })

  it('getCompletedRuns calls getCompletedRuns', async () => {
    const expected = [{ id: 'r1', status: 'completed' }]
    mockDao.getCompletedRuns.mockResolvedValue(expected)
    const result = await sessionService.getCompletedRuns()
    expect(mockDao.getCompletedRuns).toHaveBeenCalledOnce()
    expect(result).toEqual(expected)
  })

  it('getActiveRun calls getActiveRun', async () => {
    const expected = { id: 'r1', status: 'active' }
    mockDao.getActiveRun.mockResolvedValue(expected)
    const result = await sessionService.getActiveRun()
    expect(mockDao.getActiveRun).toHaveBeenCalledOnce()
    expect(result).toEqual(expected)
  })

  it('propagates errors from DAO', async () => {
    mockDao.getAllSessions.mockRejectedValue(new Error('DB error'))
    await expect(sessionService.list()).rejects.toThrow('DB error')
  })
})
