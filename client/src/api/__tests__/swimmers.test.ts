import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('swimmers API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listSwimmers delegates to swimmerService.list', async () => {
    const expected = [{ id: '1', name: 'Alice' }]
    vi.mocked(swimmerService.list).mockResolvedValue(expected)
    const result = await listSwimmers()
    expect(swimmerService.list).toHaveBeenCalledOnce()
    expect(result).toBe(expected)
  })

  it('searchSwimmers delegates to swimmerService.search', async () => {
    const expected = [{ id: '2', name: 'Bob' }]
    vi.mocked(swimmerService.search).mockResolvedValue(expected)
    const result = await searchSwimmers('Bob')
    expect(swimmerService.search).toHaveBeenCalledWith('Bob')
    expect(result).toBe(expected)
  })

  it('getSwimmer delegates to swimmerService.get', async () => {
    const expected = { id: '1', name: 'Alice' }
    vi.mocked(swimmerService.get).mockResolvedValue(expected)
    const result = await getSwimmer('1')
    expect(swimmerService.get).toHaveBeenCalledWith('1')
    expect(result).toBe(expected)
  })

  it('createSwimmer delegates to swimmerService.create', async () => {
    const data = { name: 'Charlie', groupId: 'g1' }
    vi.mocked(swimmerService.create).mockResolvedValue('new-id')
    const result = await createSwimmer(data as SafeSwimmer)
    expect(swimmerService.create).toHaveBeenCalledWith(data)
    expect(result).toBe('new-id')
  })

  it('updateSwimmer delegates to swimmerService.update', async () => {
    const data = { name: 'Updated' }
    vi.mocked(swimmerService.update).mockResolvedValue(undefined)
    await updateSwimmer('1', data)
    expect(swimmerService.update).toHaveBeenCalledWith('1', data)
  })

  it('deleteSwimmer delegates to swimmerService.delete', async () => {
    vi.mocked(swimmerService.delete).mockResolvedValue(undefined)
    await deleteSwimmer('1')
    expect(swimmerService.delete).toHaveBeenCalledWith('1')
  })
})
