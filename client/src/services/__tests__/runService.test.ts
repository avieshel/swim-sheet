import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDao = vi.hoisted(() => ({
  addSessionRun: vi.fn(),
  updateSessionRun: vi.fn(),
  getSessionRun: vi.fn(),
  getAllSessionRuns: vi.fn(),
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
  setLaneDrillResult: vi.fn(),
  deleteLaneDrillResult: vi.fn(),
  deleteLaneDrillResultsForGroup: vi.fn(),
  deleteLaneDrillResultsForRun: vi.fn(),
  clearSwimmerFromLaneDrillResult: vi.fn(),
  addLap: vi.fn(),
  getLapsForRunDrill: vi.fn(),
  getLapsForSwimmerInRun: vi.fn(),
  getSession: vi.fn(),
  getDrillsForSession: vi.fn(),
}))

vi.mock('../../db/dao', () => mockDao)

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

    it('listAll calls getAllSessionRuns', async () => {
      const expected = [{ id: 'r1' }, { id: 'r2' }]
      mockDao.getAllSessionRuns.mockResolvedValue(expected)
      const result = await runService.listAll()
      expect(mockDao.getAllSessionRuns).toHaveBeenCalledOnce()
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

    it('addDrill calls addRunDrill with data', async () => {
      const data = { run_id: 'r1', name: 'Drill', stroke: 'freestyle', distance: 100, order: 0, notes: '' }
      mockDao.addRunDrill.mockResolvedValue('new-id')
      const result = await runService.addDrill(data)
      expect(mockDao.addRunDrill).toHaveBeenCalledExactlyOnceWith(data)
      expect(result).toBe('new-id')
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

    it('setLaneResult calls setLaneDrillResult with data', async () => {
      const data = { run_id: 'r1', group_id: 'g1', lane: 1, run_drill_id: 'rd1', completed: false, data: '{}' }
      mockDao.setLaneDrillResult.mockResolvedValue('lr-id')
      const result = await runService.setLaneResult(data)
      expect(mockDao.setLaneDrillResult).toHaveBeenCalledExactlyOnceWith(data)
      expect(result).toBe('lr-id')
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

    it('clearSwimmerFromLaneResult calls clearSwimmerFromLaneDrillResult with all params', async () => {
      mockDao.clearSwimmerFromLaneDrillResult.mockResolvedValue(undefined)
      await runService.clearSwimmerFromLaneResult('r1', 'g1', 'rd1', 'sw1')
      expect(mockDao.clearSwimmerFromLaneDrillResult).toHaveBeenCalledExactlyOnceWith('r1', 'g1', 'rd1', 'sw1')
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
})
