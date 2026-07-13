import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../services/runService', () => ({
  runService: {
    getActive: vi.fn(),
    get: vi.fn(),
    listAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    complete: vi.fn(),
    createFromTemplate: vi.fn(),
    getDrills: vi.fn(),
    getDrill: vi.fn(),
    addDrill: vi.fn(),
    updateDrill: vi.fn(),
    deleteDrill: vi.fn(),
    getSwimmers: vi.fn(),
    getRunSwimmers: vi.fn(),
    addSwimmer: vi.fn(),
    removeSwimmer: vi.fn(),
    getRunsForSwimmer: vi.fn(),
    getLaneResults: vi.fn(),
    getLaneResult: vi.fn(),
    setLaneResult: vi.fn(),
    deleteLaneResult: vi.fn(),
    deleteLaneResultsForGroup: vi.fn(),
    deleteLaneResultsForRun: vi.fn(),
    clearSwimmerFromLaneResult: vi.fn(),
    getLapsForRunDrill: vi.fn(),
    getLapsForSwimmer: vi.fn(),
    addLap: vi.fn(),
  },
}))

import { getActiveRun, getRun, createRun, updateRun, completeRun, createRunFromTemplate, getRunDrills, getRunDrill, updateRunDrill, deleteRunDrill, getRunSwimmers, getRunSwimmerLinks, addSwimmerToRun, removeSwimmerFromRun, getRunsForSwimmer, getLaneResults, getLaneResult, setLaneResult, deleteLaneResult, deleteLaneResultsForGroup, deleteLaneResultsForRun, clearSwimmerFromLaneResult, getLapsForRunDrill, getLapsForSwimmer, addLap } from '../runs'
import { runService } from '../../services/runService'
import type { SafeSessionRun, SafeLaneDrillResult, SafeLap } from '../../db/schema'

describe('runs API', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Run Lifecycle ──

  it('getActiveRun delegates to runService.getActive', async () => {
    const expected = { id: 'r1', status: 'active' }
    vi.mocked(runService.getActive).mockResolvedValue(expected)
    const result = await getActiveRun()
    expect(runService.getActive).toHaveBeenCalledOnce()
    expect(result).toBe(expected)
  })

  it('getRun delegates to runService.get', async () => {
    const expected = { id: 'r1' }
    vi.mocked(runService.get).mockResolvedValue(expected)
    const result = await getRun('r1')
    expect(runService.get).toHaveBeenCalledWith('r1')
    expect(result).toBe(expected)
  })

  it('createRun delegates to runService.create', async () => {
    const data = { sessionId: 's1', date: '2024-01-01', poolName: 'Pool', poolLength: 25 }
    vi.mocked(runService.create).mockResolvedValue('new-id')
    const result = await createRun(data as SafeSessionRun)
    expect(runService.create).toHaveBeenCalledWith(data)
    expect(result).toBe('new-id')
  })

  it('updateRun delegates to runService.update', async () => {
    const data = { poolName: 'Updated Pool' }
    vi.mocked(runService.update).mockResolvedValue(undefined)
    await updateRun('r1', data)
    expect(runService.update).toHaveBeenCalledWith('r1', data)
  })

  it('completeRun delegates to runService.complete', async () => {
    vi.mocked(runService.complete).mockResolvedValue(undefined)
    await completeRun('r1')
    expect(runService.complete).toHaveBeenCalledWith('r1')
  })

  it('createRunFromTemplate delegates to runService.createFromTemplate', async () => {
    const runData = { date: '2024-01-01', poolName: 'Pool', poolLength: 25 }
    vi.mocked(runService.createFromTemplate).mockResolvedValue('new-id')
    const result = await createRunFromTemplate('s1', runData)
    expect(runService.createFromTemplate).toHaveBeenCalledWith('s1', runData)
    expect(result).toBe('new-id')
  })

  // ── Run Drills ──

  it('getRunDrills delegates to runService.getDrills', async () => {
    const expected = [{ id: 'rd1', runId: 'r1' }]
    vi.mocked(runService.getDrills).mockResolvedValue(expected)
    const result = await getRunDrills('r1')
    expect(runService.getDrills).toHaveBeenCalledWith('r1')
    expect(result).toBe(expected)
  })

  it('getRunDrill delegates to runService.getDrill', async () => {
    const expected = { id: 'rd1' }
    vi.mocked(runService.getDrill).mockResolvedValue(expected)
    const result = await getRunDrill('rd1')
    expect(runService.getDrill).toHaveBeenCalledWith('rd1')
    expect(result).toBe(expected)
  })

  it('updateRunDrill delegates to runService.updateDrill', async () => {
    const data = { name: 'Updated' }
    vi.mocked(runService.updateDrill).mockResolvedValue(undefined)
    await updateRunDrill('rd1', data)
    expect(runService.updateDrill).toHaveBeenCalledWith('rd1', data)
  })

  it('deleteRunDrill delegates to runService.deleteDrill', async () => {
    vi.mocked(runService.deleteDrill).mockResolvedValue(undefined)
    await deleteRunDrill('rd1')
    expect(runService.deleteDrill).toHaveBeenCalledWith('rd1')
  })

  // ── Run ↔ Swimmer ──

  it('getRunSwimmers delegates to runService.getSwimmers', async () => {
    const expected = [{ id: 'sw1', name: 'Alice' }]
    vi.mocked(runService.getSwimmers).mockResolvedValue(expected)
    const result = await getRunSwimmers('r1')
    expect(runService.getSwimmers).toHaveBeenCalledWith('r1')
    expect(result).toBe(expected)
  })

  it('getRunSwimmerLinks delegates to runService.getRunSwimmers', async () => {
    const expected = [{ swimmerId: 'sw1', lane: 1 }]
    vi.mocked(runService.getRunSwimmers).mockResolvedValue(expected)
    const result = await getRunSwimmerLinks('r1')
    expect(runService.getRunSwimmers).toHaveBeenCalledWith('r1')
    expect(result).toBe(expected)
  })

  it('addSwimmerToRun delegates to runService.addSwimmer', async () => {
    vi.mocked(runService.addSwimmer).mockResolvedValue(undefined)
    await addSwimmerToRun('r1', 'sw1', 2)
    expect(runService.addSwimmer).toHaveBeenCalledWith('r1', 'sw1', 2)
  })

  it('removeSwimmerFromRun delegates to runService.removeSwimmer', async () => {
    vi.mocked(runService.removeSwimmer).mockResolvedValue(undefined)
    await removeSwimmerFromRun('r1', 'sw1')
    expect(runService.removeSwimmer).toHaveBeenCalledWith('r1', 'sw1')
  })

  it('getRunsForSwimmer delegates to runService.getRunsForSwimmer', async () => {
    const expected = [{ id: 'r1' }]
    vi.mocked(runService.getRunsForSwimmer).mockResolvedValue(expected)
    const result = await getRunsForSwimmer('sw1')
    expect(runService.getRunsForSwimmer).toHaveBeenCalledWith('sw1')
    expect(result).toBe(expected)
  })

  // ── Lane Drill Results ──

  it('getLaneResults delegates to runService.getLaneResults', async () => {
    const expected = [{ id: 'lr1', runId: 'r1' }]
    vi.mocked(runService.getLaneResults).mockResolvedValue(expected)
    const result = await getLaneResults('r1')
    expect(runService.getLaneResults).toHaveBeenCalledWith('r1')
    expect(result).toBe(expected)
  })

  it('getLaneResult delegates to runService.getLaneResult', async () => {
    const expected = { id: 'lr1' }
    vi.mocked(runService.getLaneResult).mockResolvedValue(expected)
    const result = await getLaneResult('r1', 'g1', 'rd1')
    expect(runService.getLaneResult).toHaveBeenCalledWith('r1', 'g1', 'rd1')
    expect(result).toBe(expected)
  })

  it('setLaneResult delegates to runService.setLaneResult', async () => {
    const data = { run_id: 'r1', group_id: 'g1', run_drill_id: 'rd1', lane: 1, completed: false, data: '' } as SafeLaneDrillResult
    vi.mocked(runService.setLaneResult).mockResolvedValue('new-id')
    const result = await setLaneResult(data)
    expect(runService.setLaneResult).toHaveBeenCalledWith(data)
    expect(result).toBe('new-id')
  })

  it('deleteLaneResult delegates to runService.deleteLaneResult', async () => {
    vi.mocked(runService.deleteLaneResult).mockResolvedValue(undefined)
    await deleteLaneResult('lr1')
    expect(runService.deleteLaneResult).toHaveBeenCalledWith('lr1')
  })

  it('deleteLaneResultsForGroup delegates to runService.deleteLaneResultsForGroup', async () => {
    vi.mocked(runService.deleteLaneResultsForGroup).mockResolvedValue(undefined)
    await deleteLaneResultsForGroup('r1', 'g1')
    expect(runService.deleteLaneResultsForGroup).toHaveBeenCalledWith('r1', 'g1')
  })

  it('deleteLaneResultsForRun delegates to runService.deleteLaneResultsForRun', async () => {
    vi.mocked(runService.deleteLaneResultsForRun).mockResolvedValue(undefined)
    await deleteLaneResultsForRun('r1')
    expect(runService.deleteLaneResultsForRun).toHaveBeenCalledWith('r1')
  })

  it('clearSwimmerFromLaneResult delegates to runService.clearSwimmerFromLaneResult', async () => {
    vi.mocked(runService.clearSwimmerFromLaneResult).mockResolvedValue(undefined)
    await clearSwimmerFromLaneResult('r1', 'g1', 'rd1', 'sw1')
    expect(runService.clearSwimmerFromLaneResult).toHaveBeenCalledWith('r1', 'g1', 'rd1', 'sw1')
  })

  // ── Laps ──

  it('getLapsForRunDrill delegates to runService.getLapsForRunDrill', async () => {
    const expected = [{ id: 'l1', runDrillId: 'rd1' }]
    vi.mocked(runService.getLapsForRunDrill).mockResolvedValue(expected)
    const result = await getLapsForRunDrill('rd1')
    expect(runService.getLapsForRunDrill).toHaveBeenCalledWith('rd1')
    expect(result).toBe(expected)
  })

  it('getLapsForSwimmer delegates to runService.getLapsForSwimmer', async () => {
    const expected = [{ id: 'l1', swimmerId: 'sw1' }]
    vi.mocked(runService.getLapsForSwimmer).mockResolvedValue(expected)
    const result = await getLapsForSwimmer('r1', 'sw1')
    expect(runService.getLapsForSwimmer).toHaveBeenCalledWith('r1', 'sw1')
    expect(result).toBe(expected)
  })

  it('addLap delegates to runService.addLap', async () => {
    const data = { run_drill_id: 'rd1', swimmer_id: 'sw1', time: 32000, stroke_count: 0, effort: '', notes: '' } as SafeLap
    vi.mocked(runService.addLap).mockResolvedValue('new-id')
    const result = await addLap(data)
    expect(runService.addLap).toHaveBeenCalledWith(data)
    expect(result).toBe('new-id')
  })
})
