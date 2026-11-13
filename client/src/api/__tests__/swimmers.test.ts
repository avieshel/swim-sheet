import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('../../services/swimmerService', () => ({
  swimmerService: {
    list: vi.fn(),
    search: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { listSwimmers, searchSwimmers, getSwimmer, createSwimmer, updateSwimmer, deleteSwimmer } from '../swimmers'
import { swimmerService } from '../../services/swimmerService'
import type { SafeSwimmer } from '../../db/schema'

describe('swimmers API — delegation to swimmerService', () => {
  beforeEach(() => vi.clearAllMocks())

  type Delegation = {
    name: string
    run: () => Promise<unknown>
    mock: Mock
    calledWith: unknown[]
    ret: unknown
  }

  const createData = { name: 'Charlie', groupId: 'g1' } as SafeSwimmer

  const cases: Delegation[] = [
    {
      name: 'listSwimmers → list',
      run: () => listSwimmers(),
      mock: vi.mocked(swimmerService.list),
      calledWith: [],
      ret: [{ id: '1', name: 'Alice' }],
    },
    {
      name: 'searchSwimmers → search',
      run: () => searchSwimmers('Bob'),
      mock: vi.mocked(swimmerService.search),
      calledWith: ['Bob'],
      ret: [{ id: '2', name: 'Bob' }],
    },
    {
      name: 'getSwimmer → get',
      run: () => getSwimmer('1'),
      mock: vi.mocked(swimmerService.get),
      calledWith: ['1'],
      ret: { id: '1', name: 'Alice' },
    },
    {
      name: 'createSwimmer → create',
      run: () => createSwimmer(createData),
      mock: vi.mocked(swimmerService.create),
      calledWith: [createData],
      ret: 'new-id',
    },
    {
      name: 'updateSwimmer → update',
      run: () => updateSwimmer('1', { name: 'Updated' }),
      mock: vi.mocked(swimmerService.update),
      calledWith: ['1', { name: 'Updated' }],
      ret: undefined,
    },
    {
      name: 'deleteSwimmer → delete',
      run: () => deleteSwimmer('1'),
      mock: vi.mocked(swimmerService.delete),
      calledWith: ['1'],
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
