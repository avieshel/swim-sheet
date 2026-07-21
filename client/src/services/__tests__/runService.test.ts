import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDao = vi.hoisted(() => ({
  addSessionRun: vi.fn(),
  updateSessionRun: vi.fn(),
  getSessionRun: vi.fn(),
  getActiveRun: vi.fn(),
  completeSessionRun: vi.fn(),
  getRunDrillsForRun: vi.fn(),
  getRunDrill: vi.fn(),
  addRunDrill: vi.fn(),
  deleteRunDrill: vi.fn(),
  updateRunDrill: vi.fn(),
  getSwimmersForRun: vi.fn(),
  getRunSwimmersForRun: vi.fn(),
  addSwimmerToRun: vi.fn(),
  removeSwimmerFromRun: vi.fn(),
  getRunsForSwimmer: vi.fn(),
  getLaneDrillResults: vi.fn(),
  getLaneDrillResult: vi.fn(),
  deleteLaneDrillResult: vi.fn(),
  deleteLaneDrillResultsForGroup: vi.fn(),
  deleteLaneDrillResultsForRun: vi.fn(),
  addLap: vi.fn(),
  getLapsForRunDrill: vi.fn(),
  getLapsForSwimmerInRun: vi.fn(),
  getSession: vi.fn(),
  getDrillsForSession: vi.fn(),
  getAllSessions: vi.fn(),
  addSession: vi.fn(),
  addDrill: vi.fn(),
  searchSwimmers: vi.fn(),
  addSwimmer: vi.fn(),
}))

const mockDb = vi.hoisted(() => ({
  laneDrillResults: {
    where: vi.fn(),
  },
}))

vi.mock('../../db/dao', () => mockDao)
vi.mock('../../db/schema', () => ({ db: mockDb }))

const { runService } = await import('../runService')

describe('runService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('run CRUD', () => {
    it('getActive calls getActiveRun', async () => {
      const expected = { id: 'r1', status: 'active' }
      mockDao.getActiveRun.mockResolvedValue(expected)
      const result = await runService.getActive()
      expect(mockDao.getActiveRun).toHaveBeenCalledOnce()
      expect(result).toEqual(expected)
    })

    it('get calls getSessionRun with id', async () => {
      const expected = { id: 'r1' }
      mockDao.getSessionRun.mockResolvedValue(expected)
      const result = await runService.get('r1')
      expect(mockDao.getSessionRun).toHaveBeenCalledExactlyOnceWith('r1')
      expect(result).toEqual(expected)
    })

    it('create calls addSessionRun with data', async () => {
      const data = { session_id: 's1', date: '2024-01-01', poolName: 'Pool', poolLength: 25, notes: '', status: 'active' as const }
      mockDao.addSessionRun.mockResolvedValue('new-id')
      const result = await runService.create(data)
      expect(mockDao.addSessionRun).toHaveBeenCalledExactlyOnceWith(data)
      expect(result).toBe('new-id')
    })

    it('update calls updateSessionRun with id and data', async () => {
      const data = { notes: 'Updated notes' }
      mockDao.updateSessionRun.mockResolvedValue(undefined)
      await runService.update('r1', data)
      expect(mockDao.updateSessionRun).toHaveBeenCalledExactlyOnceWith('r1', data)
    })

    it('complete calls completeSessionRun with id', async () => {
      mockDao.completeSessionRun.mockResolvedValue(undefined)
      await runService.complete('r1')
      expect(mockDao.completeSessionRun).toHaveBeenCalledExactlyOnceWith('r1')
    })
  })

  describe('run drills', () => {
    it('getDrills calls getRunDrillsForRun with runId', async () => {
      const expected = [{ id: 'rd1', run_id: 'r1' }]
      mockDao.getRunDrillsForRun.mockResolvedValue(expected)
      const result = await runService.getDrills('r1')
      expect(mockDao.getRunDrillsForRun).toHaveBeenCalledExactlyOnceWith('r1')
      expect(result).toEqual(expected)
    })

    it('getDrill calls getRunDrill with id', async () => {
      const expected = { id: 'rd1' }
      mockDao.getRunDrill.mockResolvedValue(expected)
      const result = await runService.getDrill('rd1')
      expect(mockDao.getRunDrill).toHaveBeenCalledExactlyOnceWith('rd1')
      expect(result).toEqual(expected)
    })

    it('deleteDrill calls deleteRunDrill with id', async () => {
      mockDao.deleteRunDrill.mockResolvedValue(undefined)
      await runService.deleteDrill('rd1')
      expect(mockDao.deleteRunDrill).toHaveBeenCalledExactlyOnceWith('rd1')
    })

    it('updateDrill calls updateRunDrill with id and data', async () => {
      const data = { name: 'Updated Run Drill' }
      mockDao.updateRunDrill.mockResolvedValue(undefined)
      await runService.updateDrill('rd1', data)
      expect(mockDao.updateRunDrill).toHaveBeenCalledExactlyOnceWith('rd1', data)
    })
  })

  describe('swimmers', () => {
    it('getSwimmers calls getSwimmersForRun with runId', async () => {
      const expected = [{ id: 'sw1', name: 'Alice' }]
      mockDao.getSwimmersForRun.mockResolvedValue(expected)
      const result = await runService.getSwimmers('r1')
      expect(mockDao.getSwimmersForRun).toHaveBeenCalledExactlyOnceWith('r1')
      expect(result).toEqual(expected)
    })

    it('getRunSwimmers calls getRunSwimmersForRun with runId', async () => {
      const expected = [{ run_id: 'r1', swimmer_id: 'sw1', lane: 1 }]
      mockDao.getRunSwimmersForRun.mockResolvedValue(expected)
      const result = await runService.getRunSwimmers('r1')
      expect(mockDao.getRunSwimmersForRun).toHaveBeenCalledExactlyOnceWith('r1')
      expect(result).toEqual(expected)
    })

    it('addSwimmer calls addSwimmerToRun with runId, swimmerId, lane', async () => {
      mockDao.addSwimmerToRun.mockResolvedValue(undefined)
      await runService.addSwimmer('r1', 'sw1', 1)
      expect(mockDao.addSwimmerToRun).toHaveBeenCalledExactlyOnceWith('r1', 'sw1', 1)
    })

    it('removeSwimmer calls removeSwimmerFromRun with runId, swimmerId', async () => {
      mockDao.removeSwimmerFromRun.mockResolvedValue(undefined)
      await runService.removeSwimmer('r1', 'sw1')
      expect(mockDao.removeSwimmerFromRun).toHaveBeenCalledExactlyOnceWith('r1', 'sw1')
    })

    it('getRunsForSwimmer calls getRunsForSwimmer with swimmerId', async () => {
      const expected = [{ id: 'r1' }]
      mockDao.getRunsForSwimmer.mockResolvedValue(expected)
      const result = await runService.getRunsForSwimmer('sw1')
      expect(mockDao.getRunsForSwimmer).toHaveBeenCalledExactlyOnceWith('sw1')
      expect(result).toEqual(expected)
    })
  })

  describe('lane results', () => {
    it('getLaneResults calls getLaneDrillResults with runId', async () => {
      const expected = [{ id: 'lr1', run_id: 'r1' }]
      mockDao.getLaneDrillResults.mockResolvedValue(expected)
      const result = await runService.getLaneResults('r1')
      expect(mockDao.getLaneDrillResults).toHaveBeenCalledExactlyOnceWith('r1')
      expect(result).toEqual(expected)
    })

    it('getLaneResult calls getLaneDrillResult with runId, groupId, runDrillId', async () => {
      const expected = { id: 'lr1' }
      mockDao.getLaneDrillResult.mockResolvedValue(expected)
      const result = await runService.getLaneResult('r1', 'g1', 'rd1')
      expect(mockDao.getLaneDrillResult).toHaveBeenCalledExactlyOnceWith('r1', 'g1', 'rd1')
      expect(result).toEqual(expected)
    })

    it('setLaneResult upserts via db', async () => {
      const data = { run_id: 'r1', group_id: 'g1', lane: 1, run_drill_id: 'rd1', completed: false, data: '{}' }
      const mockChain = {
        first: vi.fn().mockResolvedValue(undefined),
      }
      mockDb.laneDrillResults.where.mockReturnValue(mockChain)
      const mockAdd = vi.fn().mockResolvedValue(undefined)
      mockDb.laneDrillResults.add = mockAdd

      const result = await runService.setLaneResult(data)
      expect(mockDb.laneDrillResults.where).toHaveBeenCalledWith({ run_id: 'r1', group_id: 'g1', run_drill_id: 'rd1' })
      expect(result).toMatch(/^[0-9a-f-]{36}$/)
      expect(mockAdd).toHaveBeenCalledOnce()
    })

    it('deleteLaneResult calls deleteLaneDrillResult with id', async () => {
      mockDao.deleteLaneDrillResult.mockResolvedValue(undefined)
      await runService.deleteLaneResult('lr1')
      expect(mockDao.deleteLaneDrillResult).toHaveBeenCalledExactlyOnceWith('lr1')
    })

    it('deleteLaneResultsForGroup calls deleteLaneDrillResultsForGroup with runId, groupId', async () => {
      mockDao.deleteLaneDrillResultsForGroup.mockResolvedValue(undefined)
      await runService.deleteLaneResultsForGroup('r1', 'g1')
      expect(mockDao.deleteLaneDrillResultsForGroup).toHaveBeenCalledExactlyOnceWith('r1', 'g1')
    })

    it('deleteLaneResultsForRun calls deleteLaneDrillResultsForRun with runId', async () => {
      mockDao.deleteLaneDrillResultsForRun.mockResolvedValue(undefined)
      await runService.deleteLaneResultsForRun('r1')
      expect(mockDao.deleteLaneDrillResultsForRun).toHaveBeenCalledExactlyOnceWith('r1')
    })

    it('deleteSwimmerFromLaneResult removes swimmer from db record', async () => {
      const mockResult = {
        id: 'lr1',
        data: JSON.stringify({ swimmers: [{ dbId: 'sw1' }, { dbId: 'sw2' }] }),
        completed: true,
      }
      const mockChain = {
        first: vi.fn().mockResolvedValue(mockResult),
      }
      mockDb.laneDrillResults.where.mockReturnValue(mockChain)
      const mockUpdate = vi.fn().mockResolvedValue(undefined)
      mockDb.laneDrillResults.update = mockUpdate

      await runService.deleteSwimmerFromLaneResult('r1', 'g1', 'rd1', 'sw1')
      expect(mockUpdate).toHaveBeenCalledOnce()
      const updated = JSON.parse(mockUpdate.mock.calls[0][1].data)
      expect(updated.swimmers).toEqual([{ dbId: 'sw2' }])
    })

    it('updateLaneResultSwimmer patches the matching swimmer and persists', async () => {
      mockDao.getLaneDrillResult.mockResolvedValue({
        id: 'lr1', run_id: 'r1', group_id: 'g1', run_drill_id: 'rd1', lane: 2, completed: true,
        data: JSON.stringify({ swimmers: [{ dbId: 'sw1', name: 'Old', laps: [] }] }),
      })
      const mockUpdate = vi.fn().mockResolvedValue(undefined)
      mockDb.laneDrillResults.update = mockUpdate

      await runService.updateLaneResultSwimmer('r1', 'g1', 'rd1', 'sw1', { name: 'New', completedAt: 123 })
      expect(mockUpdate).toHaveBeenCalledOnce()
      const saved = JSON.parse(mockUpdate.mock.calls[0][1].data)
      expect(saved.swimmers[0].name).toBe('New')
      expect(saved.swimmers[0].completedAt).toBe(123)
    })
  })

  describe('laps', () => {
    it('getLapsForRunDrill calls getLapsForRunDrill with runDrillId', async () => {
      const expected = [{ id: 'lp1', run_drill_id: 'rd1' }]
      mockDao.getLapsForRunDrill.mockResolvedValue(expected)
      const result = await runService.getLapsForRunDrill('rd1')
      expect(mockDao.getLapsForRunDrill).toHaveBeenCalledExactlyOnceWith('rd1')
      expect(result).toEqual(expected)
    })

    it('getLapsForSwimmer calls getLapsForSwimmerInRun with runId, swimmerId', async () => {
      const expected = [{ id: 'lp1', swimmer_id: 'sw1' }]
      mockDao.getLapsForSwimmerInRun.mockResolvedValue(expected)
      const result = await runService.getLapsForSwimmer('r1', 'sw1')
      expect(mockDao.getLapsForSwimmerInRun).toHaveBeenCalledExactlyOnceWith('r1', 'sw1')
      expect(result).toEqual(expected)
    })

    it('addLap calls addLap with data', async () => {
      const data = { run_drill_id: 'rd1', swimmer_id: 'sw1', time: 32000, stroke_count: 0, effort: '', notes: '' }
      mockDao.addLap.mockResolvedValue('lap-id')
      const result = await runService.addLap(data)
      expect(mockDao.addLap).toHaveBeenCalledExactlyOnceWith(data)
      expect(result).toBe('lap-id')
    })
  })

  describe('createFromTemplate', () => {
    const runData = { date: '2024-06-01', poolName: 'Main Pool', poolLength: 25 }

    it('throws if session not found', async () => {
      mockDao.getSession.mockResolvedValue(undefined)
      await expect(runService.createFromTemplate('s1', runData)).rejects.toThrow('Session template not found')
    })

    it('creates a run with continuous drill', async () => {
      mockDao.getSession.mockResolvedValue({ id: 's1', name: 'Session' })
      mockDao.getDrillsForSession.mockResolvedValue([
        {
          id: 'd1', name: 'Endurance Set', stroke: 'freestyle', distance: 200, order: 0,
          items: [{ id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 4 }],
          repeatCount: 1, timingMode: 'continuous', focus: 'fitness', labels: [], description: '',
        },
      ])
      mockDao.addSessionRun.mockResolvedValue('new-run-id')
      mockDao.addRunDrill.mockResolvedValue('rd1')

      const result = await runService.createFromTemplate('s1', runData)

      expect(mockDao.getSession).toHaveBeenCalledExactlyOnceWith('s1')
      expect(mockDao.getDrillsForSession).toHaveBeenCalledExactlyOnceWith('s1')
      expect(mockDao.addSessionRun).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ session_id: 's1', status: 'active' })
      )
      expect(mockDao.addRunDrill).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ run_id: 'new-run-id', name: 'Endurance Set', distance: 200, stroke: 'freestyle' })
      )
      expect(result).toBe('new-run-id')
    })

    it('creates a run with individual (unrolled) drill', async () => {
      mockDao.getSession.mockResolvedValue({ id: 's1', name: 'Session' })
      mockDao.getDrillsForSession.mockResolvedValue([
        {
          id: 'd1', name: 'Sprint Set', stroke: 'freestyle', distance: 50, order: 0,
          items: [{ id: 'i1', distance: 50, stroke: 'freestyle', repeatCount: 2 }],
          repeatCount: 2, timingMode: 'individual', focus: 'fitness', labels: [], description: '',
        },
      ])
      mockDao.addSessionRun.mockResolvedValue('new-run-id')

      const result = await runService.createFromTemplate('s1', runData)

      // 2 repeats × 1 item × 2 item repeats = 4 run drills, plus set labels
      expect(mockDao.addRunDrill).toHaveBeenCalledTimes(4)
      expect(mockDao.addRunDrill).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ name: '(1/2) Sprint Set', stroke: 'freestyle', distance: 50, order: 0 })
      )
      expect(mockDao.addRunDrill).toHaveBeenNthCalledWith(4,
        expect.objectContaining({ name: '(2/2) Sprint Set', stroke: 'freestyle', distance: 50, order: 3 })
      )
      expect(result).toBe('new-run-id')
    })

    it('skips drills with empty items array', async () => {
      mockDao.getSession.mockResolvedValue({ id: 's1', name: 'Session' })
      mockDao.getDrillsForSession.mockResolvedValue([
        {
          id: 'd1', name: 'Empty Drill', stroke: 'freestyle', distance: 0, order: 0,
          items: [], repeatCount: 1, timingMode: 'individual', focus: 'none', labels: [], description: '',
        },
        {
          id: 'd2', name: 'Valid Drill', stroke: 'freestyle', distance: 100, order: 1,
          items: [{ id: 'i1', distance: 100, stroke: 'freestyle', repeatCount: 1 }],
          repeatCount: 1, timingMode: 'individual', focus: 'none', labels: [], description: '',
        },
      ])
      mockDao.addSessionRun.mockResolvedValue('new-run-id')

      await runService.createFromTemplate('s1', runData)

      // Only the valid drill should create a run drill
      expect(mockDao.addRunDrill).toHaveBeenCalledTimes(1)
    })

    it('propagates errors', async () => {
      mockDao.getSession.mockRejectedValue(new Error('DB error'))
      await expect(runService.createFromTemplate('s1', runData)).rejects.toThrow('DB error')
    })
  })

  describe('completeRunWithLaps', () => {
    it('persists laps with ms-to-s conversion and completes run', async () => {
      mockDao.addLap.mockResolvedValue('lap-id')
      mockDao.completeSessionRun.mockResolvedValue(undefined)

      await runService.completeRunWithLaps('r1', [
        { runDrillId: 'rd1', swimmerId: 'sw1', time: 32000, strokeCount: 18 },
        { runDrillId: 'rd1', swimmerId: 'sw2', time: 65000, strokeCount: 22 },
      ])

      expect(mockDao.addLap).toHaveBeenCalledTimes(2)
      expect(mockDao.addLap).toHaveBeenNthCalledWith(1, {
        run_drill_id: 'rd1', swimmer_id: 'sw1', time: 32, stroke_count: 18, effort: '', notes: '',
      })
      expect(mockDao.addLap).toHaveBeenNthCalledWith(2, {
        run_drill_id: 'rd1', swimmer_id: 'sw2', time: 65, stroke_count: 22, effort: '', notes: '',
      })
      expect(mockDao.completeSessionRun).toHaveBeenCalledWith('r1')
    })

    it('completes run even with no laps', async () => {
      mockDao.completeSessionRun.mockResolvedValue(undefined)
      await runService.completeRunWithLaps('r1', [])
      expect(mockDao.addLap).not.toHaveBeenCalled()
      expect(mockDao.completeSessionRun).toHaveBeenCalledWith('r1')
    })
  })

  describe('createQuickStartRun', () => {
    it('finds existing default session and creates run', async () => {
      mockDao.getAllSessions.mockResolvedValue([
        { id: 'sys1', name: 'Quick 100m freestyle (default)', notes: '' },
      ])
      mockDao.getSession.mockResolvedValue({ id: 'sys1', name: 'Quick 100m freestyle (default)', poolLength: 25 })
      mockDao.getDrillsForSession.mockResolvedValue([
        { id: 'd1', name: '100m Freestyle', items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1 }], repeatCount: 1, timingMode: 'individual', order: 0, description: '' },
      ])
      mockDao.addRunDrill.mockResolvedValue('rd1')
      mockDao.addSessionRun.mockResolvedValue('run1')
      mockDao.getRunDrillsForRun.mockResolvedValue([{ id: 'rd1' }])

      const result = await runService.createQuickStartRun()

      expect(mockDao.getAllSessions).toHaveBeenCalledOnce()
      expect(mockDao.addSession).not.toHaveBeenCalled()
      expect(mockDao.addSessionRun).toHaveBeenCalledWith(
        expect.objectContaining({ session_id: 'sys1', status: 'active' })
      )
      expect(result).toEqual({ runId: 'run1', drillId: 'rd1' })
    })

    it('creates default session when none exists', async () => {
      mockDao.getAllSessions.mockResolvedValue([])
      mockDao.addSession.mockResolvedValue('sys1')
      mockDao.addDrill.mockResolvedValue('d1')
      mockDao.getSession.mockResolvedValue({ id: 'sys1', name: 'Quick 100m freestyle (default)', poolLength: 25 })
      mockDao.getDrillsForSession.mockResolvedValue([
        { id: 'd1', name: '100m Freestyle', items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1 }], repeatCount: 1, timingMode: 'individual', order: 0, description: '' },
      ])
      mockDao.addRunDrill.mockResolvedValue('rd1')
      mockDao.addSessionRun.mockResolvedValue('run1')
      mockDao.getRunDrillsForRun.mockResolvedValue([{ id: 'rd1' }])

      const result = await runService.createQuickStartRun()

      expect(mockDao.addSession).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Quick 100m freestyle (default)', notes: '' })
      )
      expect(mockDao.addDrill).toHaveBeenCalledWith(
        expect.objectContaining({ session_id: 'sys1', name: '100m Freestyle' })
      )
      expect(result).toEqual({ runId: 'run1', drillId: 'rd1' })
    })

    it('throws when session template not found after creation', async () => {
      mockDao.getAllSessions.mockResolvedValue([])
      mockDao.addSession.mockResolvedValue('sys1')
      mockDao.addDrill.mockResolvedValue('d1')
      mockDao.getSession.mockResolvedValue(undefined)

      await expect(runService.createQuickStartRun()).rejects.toThrow('Session template not found')
    })

    it('throws when no run drills created', async () => {
      mockDao.getAllSessions.mockResolvedValue([
        { id: 'sys1', name: 'Quick 100m freestyle (default)', notes: '' },
      ])
      mockDao.getSession.mockResolvedValue({ id: 'sys1', name: 'Quick 100m freestyle (default)', poolLength: 25 })
      mockDao.getDrillsForSession.mockResolvedValue([
        { id: 'd1', name: '100m Freestyle', items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1 }], repeatCount: 1, timingMode: 'individual', order: 0, description: '' },
      ])
      mockDao.addRunDrill.mockResolvedValue('rd1')
      mockDao.addSessionRun.mockResolvedValue('run1')
      mockDao.getRunDrillsForRun.mockResolvedValue([])

      await expect(runService.createQuickStartRun()).rejects.toThrow('Failed to create run drill for quick start')
    })
  })

  describe('promoteAndLinkSwimmer', () => {
    it('renames synthetic dbId to real dbId and persists laps', async () => {
      mockDao.searchSwimmers.mockResolvedValue([])
      mockDao.addSwimmer.mockResolvedValue('real1')
      mockDao.getLaneDrillResults.mockResolvedValue([
        {
          id: 'lr1', run_id: 'r1', group_id: 'g1', run_drill_id: 'rd1', lane: 1, completed: true,
          data: JSON.stringify({ swimmers: [{ dbId: 'synth1', name: 'Alice', laps: [{ time: 32000, strokeCount: 18 }], startedAt: 1000, completedAt: 33000, completed: true }] }),
        },
      ])
      const mockUpdate = vi.fn().mockResolvedValue(undefined)
      mockDb.laneDrillResults.update = mockUpdate
      mockDao.addLap.mockResolvedValue(undefined)
      mockDao.getSessionRun.mockResolvedValue({ id: 'r1', notes: '{"virtualSwimmers":[{"dbId":"synth1","lane":1}]}' })
      mockDao.addSwimmerToRun.mockResolvedValue(undefined)
      mockDao.updateSessionRun.mockResolvedValue(undefined)

      const result = await runService.promoteAndLinkSwimmer('r1', 'synth1', 'Alice')

      expect(result).toBe('real1')
      expect(mockUpdate).toHaveBeenCalledOnce()
      const saved = JSON.parse(mockUpdate.mock.calls[0][1].data)
      expect(saved.swimmers[0].dbId).toBe('real1')
      expect(mockDao.addLap).toHaveBeenCalledOnce()
      expect(mockDao.addLap).toHaveBeenCalledWith(
        expect.objectContaining({ swimmer_id: 'real1', time: 32 })
      )
    })
  })
})
