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
  getActiveRunsForSession: vi.fn(),
  getCompletedRunCountForSession: vi.fn(),
  getSessionRunUsage: vi.fn(),
  seedDefaultSessions: vi.fn(),
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
    mockDao.seedDefaultSessions.mockResolvedValue(undefined)
    const result = await sessionService.list()
    expect(mockDao.seedDefaultSessions).toHaveBeenCalledOnce()
    expect(mockDao.getAllSessions).toHaveBeenCalledOnce()
    expect(result).toEqual(expected)
  })

  it('listAll returns sessions without seeding', async () => {
    const expected = [{ id: '2', name: 'Session 2' }]
    mockDao.getAllSessions.mockResolvedValue(expected)
    const result = await sessionService.listAll()
    expect(mockDao.seedDefaultSessions).not.toHaveBeenCalled()
    expect(mockDao.getAllSessions).toHaveBeenCalledOnce()
    expect(result).toEqual(expected)
  })

  it('listByUsage ranks sessions by use count, then recency, then creation', async () => {
    mockDao.getAllSessions.mockResolvedValue([
      { id: 'a', name: 'A', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', name: 'B', createdAt: '2026-01-02T00:00:00.000Z' },
      { id: 'c', name: 'C', createdAt: '2026-01-03T00:00:00.000Z' },
      { id: 'd', name: 'D', createdAt: '2026-01-04T00:00:00.000Z' },
    ])
    mockDao.getSessionRunUsage.mockResolvedValue([
      { sessionId: 'c', count: 3, lastUsedAt: 200 },
      { sessionId: 'b', count: 1, lastUsedAt: 999 },
      { sessionId: 'a', count: 1, lastUsedAt: 100 },
    ])
    const result = await sessionService.listByUsage()
    expect(result.map(s => s.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(mockDao.seedDefaultSessions).not.toHaveBeenCalled()
  })

  it('get calls getSession with id', async () => {
    const expected = { id: '1', name: 'Session 1' }
    mockDao.getSession.mockResolvedValue(expected)
    const result = await sessionService.get('1')
    expect(mockDao.getSession).toHaveBeenCalledExactlyOnceWith('1')
    expect(result).toEqual(expected)
  })

  it('create calls addSession with data', async () => {
    const data = { name: 'New Session', notes: '' }
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

  it('delete calls deleteSession with id when no run is active', async () => {
    mockDao.getActiveRunsForSession.mockResolvedValue([])
    mockDao.deleteSession.mockResolvedValue(undefined)
    expect(await sessionService.delete('1')).toEqual({ ok: true })
    expect(mockDao.deleteSession).toHaveBeenCalledExactlyOnceWith('1')
  })

  describe('delete guards', () => {
    const run = (over: Record<string, unknown> = {}) => ({ id: 'r1', sessionId: '1', status: 'active', ...over })

    it('refuses and returns the run when an active run exists', async () => {
      const active = run()
      mockDao.getActiveRunsForSession.mockResolvedValue([active])
      mockDao.getCompletedRunCountForSession.mockResolvedValue(0)

      const result = await sessionService.delete('1')

      expect(result).toEqual({ ok: false, reason: 'active_run', run: active })
      expect(mockDao.deleteSession).not.toHaveBeenCalled()
    })

    it('does not count a completed run as a blocker', async () => {
      mockDao.getActiveRunsForSession.mockResolvedValue([])
      mockDao.getCompletedRunCountForSession.mockResolvedValue(12)

      expect(await sessionService.delete('1')).toEqual({ ok: true })
      expect(mockDao.deleteSession).toHaveBeenCalledExactlyOnceWith('1')
    })

    it('deletes a session that has never been run', async () => {
      mockDao.getActiveRunsForSession.mockResolvedValue([])
      mockDao.getCompletedRunCountForSession.mockResolvedValue(0)
      expect(await sessionService.delete('1')).toEqual({ ok: true })
    })

    it('re-checks active runs rather than trusting the caller', async () => {
      // The guard must run on every call: a run may have been started on
      // another device that has not synced back yet.
      mockDao.getActiveRunsForSession.mockResolvedValue([run({ id: 'r2' })])

      const result = await sessionService.delete('1')

      expect(mockDao.getActiveRunsForSession).toHaveBeenCalledExactlyOnceWith('1')
      expect(result).toEqual({ ok: false, reason: 'active_run', run: expect.objectContaining({ id: 'r2' }) })
      expect(mockDao.deleteSession).not.toHaveBeenCalled()
    })
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
