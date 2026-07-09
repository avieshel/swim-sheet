import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDao = vi.hoisted(() => ({
  getAllSwimmers: vi.fn(),
  searchSwimmers: vi.fn(),
  getSwimmer: vi.fn(),
  addSwimmer: vi.fn(),
  updateSwimmer: vi.fn(),
  deleteSwimmer: vi.fn(),
}))

vi.mock('../../db/dao', () => mockDao)

const { swimmerService } = await import('../swimmerService')

describe('swimmerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list calls getAllSwimmers and returns result', async () => {
    const expected = [{ id: '1', name: 'Alice' }]
    mockDao.getAllSwimmers.mockResolvedValue(expected)
    const result = await swimmerService.list()
    expect(mockDao.getAllSwimmers).toHaveBeenCalledOnce()
    expect(result).toEqual(expected)
  })

  it('search calls searchSwimmers with query', async () => {
    const expected = [{ id: '1', name: 'Alice' }]
    mockDao.searchSwimmers.mockResolvedValue(expected)
    const result = await swimmerService.search('Alice')
    expect(mockDao.searchSwimmers).toHaveBeenCalledExactlyOnceWith('Alice')
    expect(result).toEqual(expected)
  })

  it('get calls getSwimmer with id', async () => {
    const expected = { id: '1', name: 'Alice' }
    mockDao.getSwimmer.mockResolvedValue(expected)
    const result = await swimmerService.get('1')
    expect(mockDao.getSwimmer).toHaveBeenCalledExactlyOnceWith('1')
    expect(result).toEqual(expected)
  })

  it('create calls addSwimmer with data and returns id', async () => {
    const data = { name: 'Bob', group: 'A', notes: '' }
    mockDao.addSwimmer.mockResolvedValue('new-id')
    const result = await swimmerService.create(data)
    expect(mockDao.addSwimmer).toHaveBeenCalledExactlyOnceWith(data)
    expect(result).toBe('new-id')
  })

  it('update calls updateSwimmer with id and data', async () => {
    const data = { name: 'Bob Updated' }
    mockDao.updateSwimmer.mockResolvedValue(undefined)
    await swimmerService.update('1', data)
    expect(mockDao.updateSwimmer).toHaveBeenCalledExactlyOnceWith('1', data)
  })

  it('delete calls deleteSwimmer with id', async () => {
    mockDao.deleteSwimmer.mockResolvedValue(undefined)
    await swimmerService.delete('1')
    expect(mockDao.deleteSwimmer).toHaveBeenCalledExactlyOnceWith('1')
  })

  it('propagates errors from DAO', async () => {
    mockDao.getAllSwimmers.mockRejectedValue(new Error('DB error'))
    await expect(swimmerService.list()).rejects.toThrow('DB error')
  })
})
