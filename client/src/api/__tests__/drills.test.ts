import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

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

import {
  getSessionDrills,
  getDrill,
  createDrill,
  updateDrill,
  deleteDrill,
  listLibraryDrills,
  createLibraryDrill,
  updateLibraryDrill,
  deleteLibraryDrill,
  patchLibraryDrills,
  resetLibraryToDefaults,
  seedLibraryDrills,
} from '../drills'
import { drillService } from '../../services/drillService'

describe('drills API — delegation to drillService', () => {
  beforeEach(() => vi.clearAllMocks())

  type Delegation = {
    name: string
    run: () => Promise<unknown>
    mock: Mock
    calledWith: unknown[]
    ret: unknown
  }

  const cases: Delegation[] = [
    {
      name: 'getSessionDrills → getDrills',
      run: () => getSessionDrills('s1'),
      mock: vi.mocked(drillService.getDrills),
      calledWith: ['s1'],
      ret: [{ id: 'd1', sessionId: 's1' }],
    },
    {
      name: 'getDrill → get',
      run: () => getDrill('d1'),
      mock: vi.mocked(drillService.get),
      calledWith: ['d1'],
      ret: { id: 'd1' },
    },
    {
      name: 'createDrill → create',
      run: () =>
        createDrill({ sessionId: 's1', name: 'Test', distance: 100, stroke: 'freestyle' as const, order: 0 }),
      mock: vi.mocked(drillService.create),
      calledWith: [{ sessionId: 's1', name: 'Test', distance: 100, stroke: 'freestyle' as const, order: 0 }],
      ret: 'new-id',
    },
    {
      name: 'updateDrill → update',
      run: () => updateDrill('d1', { name: 'Updated' }),
      mock: vi.mocked(drillService.update),
      calledWith: ['d1', { name: 'Updated' }],
      ret: undefined,
    },
    {
      name: 'deleteDrill → delete',
      run: () => deleteDrill('d1'),
      mock: vi.mocked(drillService.delete),
      calledWith: ['d1'],
      ret: undefined,
    },
    {
      name: 'listLibraryDrills → listLibrary',
      run: () => listLibraryDrills(),
      mock: vi.mocked(drillService.listLibrary),
      calledWith: [],
      ret: [{ id: 'ld1' }],
    },
    {
      name: 'createLibraryDrill → createLibrary',
      run: () => createLibraryDrill({ name: 'Lib Drill', stroke: 'freestyle' as const, distance: 50 }),
      mock: vi.mocked(drillService.createLibrary),
      calledWith: [{ name: 'Lib Drill', stroke: 'freestyle' as const, distance: 50 }],
      ret: 'new-id',
    },
    {
      name: 'updateLibraryDrill → updateLibrary',
      run: () => updateLibraryDrill('ld1', { name: 'Updated Lib' }),
      mock: vi.mocked(drillService.updateLibrary),
      calledWith: ['ld1', { name: 'Updated Lib' }],
      ret: undefined,
    },
    {
      name: 'deleteLibraryDrill → deleteLibrary',
      run: () => deleteLibraryDrill('ld1'),
      mock: vi.mocked(drillService.deleteLibrary),
      calledWith: ['ld1'],
      ret: undefined,
    },
    {
      name: 'patchLibraryDrills → patchLibrary',
      run: () => patchLibraryDrills(),
      mock: vi.mocked(drillService.patchLibrary),
      calledWith: [],
      ret: undefined,
    },
    {
      name: 'resetLibraryToDefaults → resetLibraryToDefaults',
      run: () => resetLibraryToDefaults(),
      mock: vi.mocked(drillService.resetLibraryToDefaults),
      calledWith: [],
      ret: undefined,
    },
    {
      name: 'seedLibraryDrills → seedLibrary',
      run: () => seedLibraryDrills(),
      mock: vi.mocked(drillService.seedLibrary),
      calledWith: [],
      ret: undefined,
    },
  ]

  it.each(cases)('$name', async (c) => {
    c.mock.mockResolvedValue(c.ret)
    const result = await c.run()
    expect(c.mock).toHaveBeenCalledExactlyOnceWith(...c.calledWith)
    expect(result).toBe(c.ret)
  })
})
