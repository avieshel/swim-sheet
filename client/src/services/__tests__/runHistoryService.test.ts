import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionRun, Swimmer, SavedDrillData } from '../../db/schema'

const mockDao = vi.hoisted(() => ({
  getCompletedRuns: vi.fn(),
  getSession: vi.fn(),
  getSessionRun: vi.fn(),
  getRunDrillsForRun: vi.fn(),
  getRunSwimmersForRun: vi.fn(),
  getSwimmersForRun: vi.fn(),
  getLaneDrillResults: vi.fn(),
  getLapsForRun: vi.fn(),
  getSwimmer: vi.fn(),
  deleteSessionRunCascade: vi.fn(),
}))

vi.mock('../../db/dao', () => mockDao)

const { getRunHistory, getRunById, deleteRun, exportRun } = await import('../runHistoryService')

const makeRun = (overrides: Partial<SessionRun> = {}): SessionRun => ({
  id: 'r1',
  session_id: 's1',
  date: '2024-06-01',
  poolName: 'Main Pool',
  poolLength: 25,
  notes: '',
  status: 'completed',
  session_started_at: 0,
  session_paused_at: null,
  session_pause_duration: 0,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
  ...overrides,
})

const makeSwimmer = (overrides: Partial<Swimmer>): Swimmer => ({
  id: 'sw1',
  name: 'Alice',
  group: 'Fast',
  notes: '',
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const makeBlob = (swimmers: SavedDrillData['swimmers'], overrides: Partial<SavedDrillData> = {}): string =>
  JSON.stringify({ drillStart: 0, drillEnd: 60000, sessionStartedAt: 0, swimmers, ...overrides })

describe('runHistoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDao.getSession.mockResolvedValue({ id: 's1', name: 'Tuesday Endurance', poolLength: 25, notes: '', createdAt: '', updatedAt: '' })
  })

  it('returns empty history for an empty database', async () => {
    mockDao.getCompletedRuns.mockResolvedValue([])
    const result = await getRunHistory()
    expect(result).toEqual({ runs: [], totalRuns: 0 })
  })

  it('builds a summary with real swimmers and blob timing', async () => {
    mockDao.getCompletedRuns.mockResolvedValue([makeRun()])
    mockDao.getRunDrillsForRun.mockResolvedValue([
      { id: 'rd1', run_id: 'r1', name: 'Warmup', stroke: 'freestyle', distance: 200, order: 0, notes: '', createdAt: '', updatedAt: '' },
    ])
    mockDao.getRunSwimmersForRun.mockResolvedValue([
      { id: 'rsw1', run_id: 'r1', swimmer_id: 'sw1', lane: 1, createdAt: '', updatedAt: '' },
    ])
    mockDao.getSwimmersForRun.mockResolvedValue([makeSwimmer({})])
    mockDao.getLaneDrillResults.mockResolvedValue([
      {
        id: 'lr1', run_id: 'r1', group_id: 'g1', lane: 1, run_drill_id: 'rd1', completed: true, updatedAt: '',
        data: makeBlob([
          { dbId: 'sw1', name: 'Alice', startedAt: 1000, completedAt: 33000, laps: [{ time: 16000, strokeCount: 18 }, { time: 16500 }], completed: true },
        ]),
      },
    ])
    mockDao.getLapsForRun.mockResolvedValue([])

    const { runs, totalRuns } = await getRunHistory()
    expect(totalRuns).toBe(1)
    const [run] = runs
    expect(run).toMatchObject({
      runId: 'r1',
      sessionId: 's1',
      templateName: 'Tuesday Endurance',
      date: '2024-06-01',
      poolName: 'Main Pool',
      poolLength: 25,
      status: 'completed',
      totalSwimmers: 1,
      recordedTimesCount: 1,
      completedLaps: 2,
    })
    expect(run.swimmers).toHaveLength(1)
    expect(run.swimmers[0]).toMatchObject({
      swimmerId: 'sw1',
      name: 'Alice',
      isVirtual: false,
      totalTimeMs: 32500,
    })
    expect(run.swimmers[0].timeEntries).toEqual([
      { drillId: 'rd1', label: 'Warmup', totalMs: 32500, unitMs: 16250 },
    ])
  })

  it('includes virtual swimmers from blobs only', async () => {
    mockDao.getCompletedRuns.mockResolvedValue([makeRun()])
    mockDao.getRunDrillsForRun.mockResolvedValue([
      { id: 'rd1', run_id: 'r1', name: 'Quick Time', stroke: 'freestyle', distance: 100, order: 0, notes: '', createdAt: '', updatedAt: '' },
    ])
    mockDao.getRunSwimmersForRun.mockResolvedValue([])
    mockDao.getSwimmersForRun.mockResolvedValue([])
    mockDao.getLaneDrillResults.mockResolvedValue([
      {
        id: 'lr1', run_id: 'r1', group_id: 'g1', lane: 1, run_drill_id: 'rd1', completed: true, updatedAt: '',
        data: makeBlob([
          { dbId: 'quick-1', name: 'Mia', startedAt: 1000, completedAt: 11000, laps: [{ time: 10000 }], completed: true },
          { dbId: 'quick-2', name: 'Leo', startedAt: 1000, completedAt: 60000, laps: [], completed: true },
        ]),
      },
    ])
    mockDao.getLapsForRun.mockResolvedValue([])

    const { runs } = await getRunHistory()
    expect(runs).toHaveLength(1)
    const { swimmers, totalSwimmers, recordedTimesCount } = runs[0]
    expect(totalSwimmers).toBe(2)
    expect(recordedTimesCount).toBe(2)
    expect(swimmers.map(s => s.name)).toEqual(['Leo', 'Mia'])
    for (const s of swimmers) {
      expect(s.swimmerId).toBeNull()
      expect(s.isVirtual).toBe(true)
    }
    expect(swimmers.find(s => s.name === 'Mia')?.timeEntries[0]).toMatchObject({ totalMs: 10000, unitMs: 10000 })
    expect(swimmers.find(s => s.name === 'Leo')?.timeEntries[0]).toMatchObject({ totalMs: 59000 })
  })

  it('filters runs by real RunSwimmer participation', async () => {
    mockDao.getCompletedRuns.mockResolvedValue([
      makeRun({ id: 'r1' }),
      makeRun({ id: 'r2', date: '2024-06-02', createdAt: '2024-06-02T10:00:00.000Z' }),
    ])
    mockDao.getSwimmer.mockResolvedValue(makeSwimmer({}))
    mockDao.getRunDrillsForRun.mockResolvedValue([])
    mockDao.getLaneDrillResults.mockResolvedValue([])
    mockDao.getLapsForRun.mockResolvedValue([])

    mockDao.getRunSwimmersForRun.mockImplementation(async (runId: string) =>
      runId === 'r1'
        ? [{ id: 'rsw1', run_id: 'r1', swimmer_id: 'sw1', lane: 1, createdAt: '', updatedAt: '' }]
        : [{ id: 'rsw2', run_id: 'r2', swimmer_id: 'sw2', lane: 1, createdAt: '', updatedAt: '' }],
    )
    mockDao.getSwimmersForRun.mockImplementation(async (runId: string) =>
      runId === 'r1'
        ? [makeSwimmer({})]
        : [makeSwimmer({ id: 'sw2', name: 'Bob' })],
    )

    const { runs, totalRuns } = await getRunHistory('sw1')
    expect(totalRuns).toBe(1)
    expect(runs[0].runId).toBe('r1')
    expect(runs[0].swimmers[0]).toMatchObject({ swimmerId: 'sw1', name: 'Alice' })
  })

  it('matches virtual-only runs by blob name and flags matchedByName', async () => {
    mockDao.getCompletedRuns.mockResolvedValue([
      makeRun({ id: 'r1' }),
      makeRun({ id: 'r2', date: '2024-06-02', createdAt: '2024-06-02T10:00:00.000Z' }),
    ])
    mockDao.getSwimmer.mockResolvedValue(makeSwimmer({ id: 'sw-jane', name: 'Jane' }))
    mockDao.getRunDrillsForRun.mockResolvedValue([])
    mockDao.getRunSwimmersForRun.mockResolvedValue([])
    mockDao.getSwimmersForRun.mockResolvedValue([])
    mockDao.getLapsForRun.mockResolvedValue([])
    mockDao.getLaneDrillResults.mockImplementation(async (runId: string) =>
      runId === 'r1'
        ? [{
            id: 'lr1', run_id: 'r1', group_id: 'g1', lane: 1, run_drill_id: 'rd1', completed: true, updatedAt: '',
            data: makeBlob([{ dbId: 'quick-1', name: 'jane', startedAt: 1000, completedAt: 11000, laps: [{ time: 10000 }], completed: true }]),
          }]
        : [{
            id: 'lr2', run_id: 'r2', group_id: 'g1', lane: 1, run_drill_id: 'rd2', completed: true, updatedAt: '',
            data: makeBlob([{ dbId: 'quick-2', name: 'Mia', startedAt: 1000, completedAt: 11000, laps: [{ time: 10000 }], completed: true }]),
          }],
    )

    const { runs, totalRuns } = await getRunHistory('sw-jane')
    expect(totalRuns).toBe(1)
    expect(runs[0].runId).toBe('r1')
    expect(runs[0].swimmers[0]).toMatchObject({
      swimmerId: null,
      name: 'jane',
      isVirtual: true,
      matchedByName: true,
    })
  })

  it('sorts runs newest-first by date', async () => {
    mockDao.getCompletedRuns.mockResolvedValue([
      makeRun({ id: 'r1', date: '2024-06-01', createdAt: '2024-06-01T10:00:00.000Z' }),
      makeRun({ id: 'r2', date: '2024-06-03', createdAt: '2024-06-03T10:00:00.000Z' }),
      makeRun({ id: 'r3', date: '2024-06-02', createdAt: '2024-06-02T10:00:00.000Z' }),
    ])
    mockDao.getRunDrillsForRun.mockResolvedValue([])
    mockDao.getRunSwimmersForRun.mockResolvedValue([])
    mockDao.getSwimmersForRun.mockResolvedValue([])
    mockDao.getLaneDrillResults.mockResolvedValue([])
    mockDao.getLapsForRun.mockResolvedValue([])

    const { runs } = await getRunHistory()
    expect(runs.map(r => r.runId)).toEqual(['r2', 'r3', 'r1'])
  })

  it('getRunById returns null for an unknown run', async () => {
    mockDao.getSessionRun.mockResolvedValue(undefined)
    const result = await getRunById('missing')
    expect(result).toBeNull()
  })

  it('getRunById builds a single-run summary', async () => {
    mockDao.getSessionRun.mockResolvedValue(makeRun())
    mockDao.getRunDrillsForRun.mockResolvedValue([
      { id: 'rd1', run_id: 'r1', name: 'Warmup', stroke: 'freestyle', distance: 200, order: 0, notes: '', createdAt: '', updatedAt: '' },
    ])
    mockDao.getRunSwimmersForRun.mockResolvedValue([
      { id: 'rsw1', run_id: 'r1', swimmer_id: 'sw1', lane: 1, createdAt: '', updatedAt: '' },
    ])
    mockDao.getSwimmersForRun.mockResolvedValue([makeSwimmer({})])
    mockDao.getLaneDrillResults.mockResolvedValue([
      {
        id: 'lr1', run_id: 'r1', group_id: 'g1', lane: 1, run_drill_id: 'rd1', completed: true, updatedAt: '',
        data: makeBlob([
          { dbId: 'sw1', name: 'Alice', startedAt: 1000, completedAt: 33000, laps: [{ time: 16000, strokeCount: 18 }, { time: 16500 }], completed: true },
        ]),
      },
    ])
    mockDao.getLapsForRun.mockResolvedValue([])

    const run = await getRunById('r1')
    expect(run).not.toBeNull()
    expect(run?.runId).toBe('r1')
    expect(run?.swimmers[0]).toMatchObject({ name: 'Alice', totalTimeMs: 32500 })
  })

  it('deleteRun cascades via the dao', async () => {
    mockDao.deleteSessionRunCascade.mockResolvedValue(undefined)
    await deleteRun('r1')
    expect(mockDao.deleteSessionRunCascade).toHaveBeenCalledExactlyOnceWith('r1')
  })

  it('exportRun builds a JSON blob with run, drills, and swimmers', async () => {
    mockDao.getSessionRun.mockResolvedValue(makeRun())
    mockDao.getRunDrillsForRun.mockResolvedValue([
      { id: 'rd1', run_id: 'r1', name: 'Warmup', stroke: 'freestyle', distance: 200, order: 0, notes: '', createdAt: '', updatedAt: '' },
    ])
    mockDao.getRunSwimmersForRun.mockResolvedValue([])
    mockDao.getSwimmersForRun.mockResolvedValue([])
    mockDao.getLaneDrillResults.mockResolvedValue([])
    mockDao.getLapsForRun.mockResolvedValue([])

    const blob = await exportRun('r1')
    expect(blob).toBeInstanceOf(Blob)
    const payload = JSON.parse(await blob.text()) as Record<string, unknown>
    expect(payload.templateName).toBe('Tuesday Endurance')
    expect((payload.drills as { name: string }[])[0].name).toBe('Warmup')
    expect(Array.isArray(payload.swimmers)).toBe(true)
    expect(Array.isArray(payload.laps)).toBe(true)
  })

  it('exportRun throws when the run is missing', async () => {
    mockDao.getSessionRun.mockResolvedValue(undefined)
    await expect(exportRun('missing')).rejects.toThrow('Run not found')
  })
})
