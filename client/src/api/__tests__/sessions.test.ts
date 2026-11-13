import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

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
  applySessionDraft: (input: unknown) => mockApply.applySessionDraft(input),
}))

import { listSessions, getSession, createSession, updateSession, deleteSession, listCompletedRuns, createSessionFromDraft } from '../sessions'
import { sessionService } from '../../services/sessionService'
import type { SafeSession } from '../../db/schema'

describe('sessions API — delegation to sessionService', () => {
  beforeEach(() => vi.clearAllMocks())

  type Delegation = {
    name: string
    run: () => Promise<unknown>
    mock: Mock
    calledWith: unknown[]
    ret: unknown
  }

  const createData = { name: 'Test' } as SafeSession
  const updateData = { name: 'Updated' }

  const cases: Delegation[] = [
    {
      name: 'listSessions → list',
      run: () => listSessions(),
      mock: vi.mocked(sessionService.list),
      calledWith: [],
      ret: [{ id: 's1' }],
    },
    {
      name: 'getSession → get',
      run: () => getSession('s1'),
      mock: vi.mocked(sessionService.get),
      calledWith: ['s1'],
      ret: { id: 's1' },
    },
    {
      name: 'createSession → create',
      run: () => createSession(createData),
      mock: vi.mocked(sessionService.create),
      calledWith: [createData],
      ret: 'new-id',
    },
    {
      name: 'updateSession → update',
      run: () => updateSession('s1', updateData),
      mock: vi.mocked(sessionService.update),
      calledWith: ['s1', updateData],
      ret: undefined,
    },
    {
      name: 'deleteSession → delete',
      run: () => deleteSession('s1'),
      mock: vi.mocked(sessionService.delete),
      calledWith: ['s1'],
      ret: undefined,
    },
    {
      name: 'listCompletedRuns → getCompletedRuns',
      run: () => listCompletedRuns(),
      mock: vi.mocked(sessionService.getCompletedRuns),
      calledWith: [],
      ret: [{ id: 'r1' }],
    },
  ]

  it.each(cases)('$name', async (c) => {
    c.mock.mockResolvedValue(c.ret)
    const result = await c.run()
    expect(c.mock).toHaveBeenCalledExactlyOnceWith(...c.calledWith)
    expect(result).toBe(c.ret)
  })
})

describe('createSessionFromDraft (direct, no harness)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('routes to the draft service and leaves the session unmarked', async () => {
    const draft = { schemaVersion: 1, session: { name: 'X' }, drills: [] }
    mockApply.applySessionDraft.mockResolvedValue({ outcome: 'created', sessionId: 's9' })
    const result = await createSessionFromDraft(draft)
    expect(mockApply.applySessionDraft).toHaveBeenCalledWith(draft)
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
