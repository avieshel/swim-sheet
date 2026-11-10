// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { CoachAssistProvider } from '../CoachAssistContext'
import { useCoachAssist } from '../coachAssistShared'
import { isCoachAssistMode, configureCoachAssist } from '../../db/adminDao'

vi.mock('../../services/admin/useAdminStatus', () => ({
  useAdminStatus: () => ({ isOwner: true, loading: false }),
}))

vi.mock('../../services/admin/adminCoachService', () => ({
  getAdminStatus: vi.fn(async () => ({ isOwner: true })),
  listCoaches: vi.fn(async () => [
    { userId: 'c1', name: 'Coach One', email: 'c1@example.com', orgId: 'o1' },
  ]),
  getCoachData: vi.fn(async () => ({ sessions: [], swimmers: [], libraryDrills: [], drills: [] })),
  adminCreate: vi.fn(async () => ''),
  adminUpdate: vi.fn(async () => {}),
  adminDelete: vi.fn(async () => {}),
  adminMaterializeDraft: vi.fn(async () => ({ sessionId: '', drillIds: [] })),
}))

describe('CoachAssistContext', () => {
  beforeEach(() => {
    configureCoachAssist(null)
  })

  it('selectCoach configures adminDao; exit clears it', async () => {
    const { result } = renderHook(() => useCoachAssist(), {
      wrapper: ({ children }) => <CoachAssistProvider>{children}</CoachAssistProvider>,
    })

    await waitFor(() => expect(result.current.isOwner).toBe(true))
    await waitFor(() => expect(result.current.coaches.length).toBe(1))
    await act(async () => {
      await result.current.selectCoach('c1')
    })
    expect(isCoachAssistMode()).toBe(true)

    act(() => result.current.exit())
    expect(isCoachAssistMode()).toBe(false)
  })
})
