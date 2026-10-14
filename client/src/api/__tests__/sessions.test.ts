import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../services/sessionService', () => ({
  sessionService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getRuns: vi.fn(),
    getCompletedRuns: vi.fn(),
  },
}))

const mockApply = vi.hoisted(() => ({
  applySessionDraft: vi.fn(),
}))

vi.mock('../../services/sessionDraft/apply', () => ({
  applySessionDraft: (input: unknown, options: { markUnreviewed: boolean }) =>
    mockApply.applySessionDraft(input, options),
}))

import { listSessions, getSession, createSession, updateSession, deleteSession, listCompletedRuns, createSessionFromDraft } from '../sessions'
import { sessionService } from '../../services/sessionService'
import type { SafeSession } from '../../db/schema'

describe('sessions API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listSessions delegates to sessionService.list', async () => {
    const expected = [{ id: 's1' }]
    vi.mocked(sessionService.list).mockResolvedValue(expected)
    const result = await listSessions()
    expect(sessionService.list).toHaveBeenCalledOnce()
    expect(result).toBe(expected)
  })

  it('getSession delegates to sessionService.get', async () => {
    const expected = { id: 's1' }
    vi.mocked(sessionService.get).mockResolvedValue(expected)
    const result = await getSession('s1')
    expect(sessionService.get).toHaveBeenCalledWith('s1')
    expect(result).toBe(expected)
  })

  it('createSession delegates to sessionService.create', async () => {
    const data = { name: 'Test' }
    vi.mocked(sessionService.create).mockResolvedValue('new-id')
    const result = await createSession(data as SafeSession)
    expect(sessionService.create).toHaveBeenCalledWith(data)
    expect(result).toBe('new-id')
  })

  it('updateSession delegates to sessionService.update', async () => {
    const data = { name: 'Updated' }
    vi.mocked(sessionService.update).mockResolvedValue(undefined)
    await updateSession('s1', data)
    expect(sessionService.update).toHaveBeenCalledWith('s1', data)
  })

  it('deleteSession delegates to sessionService.delete', async () => {
    vi.mocked(sessionService.delete).mockResolvedValue(undefined)
    await deleteSession('s1')
    expect(sessionService.delete).toHaveBeenCalledWith('s1')
  })

  it('listCompletedRuns delegates to sessionService.getCompletedRuns', async () => {
    const expected = [{ id: 'r1' }]
    vi.mocked(sessionService.getCompletedRuns).mockResolvedValue(expected)
    const result = await listCompletedRuns()
    expect(sessionService.getCompletedRuns).toHaveBeenCalledOnce()
    expect(result).toBe(expected)
  })
})

describe('createSessionFromDraft (direct, no harness)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('routes to the draft service and leaves the session unmarked', async () => {
    const draft = { schemaVersion: 1, session: { name: 'X' }, drills: [] }
    mockApply.applySessionDraft.mockResolvedValue({ outcome: 'created', sessionId: 's9' })
    const result = await createSessionFromDraft(draft)
    expect(mockApply.applySessionDraft).toHaveBeenCalledWith(draft, { markUnreviewed: false })
    expect(result).toEqual({ outcome: 'created', sessionId: 's9' })
  })

  it('propagates an invalid draft without marking', async () => {
    mockApply.applySessionDraft.mockResolvedValue({
      outcome: 'invalid',
      error: { code: 'invalid_shape', message: 'bad' },
    })
    const result = await createSessionFromDraft({ schemaVersion: 2 })
    expect(result).toEqual({
      outcome: 'invalid',
      error: { code: 'invalid_shape', message: 'bad' },
    })
  })
})
