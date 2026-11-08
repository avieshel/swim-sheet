// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => {
  const noop = vi.fn()
  return {
    status: { isOwner: false, loading: false },
    listCoaches: vi.fn(),
    getCoachData: vi.fn(),
    adminCreate: noop,
    adminUpdate: noop,
    adminDelete: noop,
    adminMaterializeDraft: noop,
    toSwimmerRow: noop,
    toDrillRow: noop,
    toSessionPatch: noop,
  }
})

vi.mock('../../services/admin/useAdminStatus', () => ({
  useAdminStatus: () => mocks.status,
}))

vi.mock('../../services/admin/adminCoachService', () => ({
  listCoaches: (...args: unknown[]) => mocks.listCoaches(...args),
  getCoachData: (...args: unknown[]) => mocks.getCoachData(...args),
  adminCreate: (...args: unknown[]) => mocks.adminCreate(...args),
  adminUpdate: (...args: unknown[]) => mocks.adminUpdate(...args),
  adminDelete: (...args: unknown[]) => mocks.adminDelete(...args),
  adminMaterializeDraft: (...args: unknown[]) => mocks.adminMaterializeDraft(...args),
}))

const { AdminCoachAssist } = await import('../AdminCoachAssist')

afterEach(() => {
  cleanup()
  mocks.status = { isOwner: false, loading: false }
  mocks.listCoaches.mockReset()
  mocks.getCoachData.mockReset()
  vi.clearAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminCoachAssist />
    </MemoryRouter>,
  )
}

describe('AdminCoachAssist', () => {
  it('renders "Not authorized" and no coach picker when not owner', async () => {
    mocks.status = { isOwner: false, loading: false }

    renderPage()

    expect(screen.getByText('Not authorized')).toBeTruthy()
    expect(screen.queryByLabelText('Select coach')).toBeNull()
  })

  it('shows the coach picker when owner and opens the swimmer modal', async () => {
    mocks.status = { isOwner: true, loading: false }
    mocks.listCoaches.mockResolvedValue([
      { userId: 'c1', name: 'Coach A', email: 'a@b.c', orgId: 'org1' },
    ])
    mocks.getCoachData.mockResolvedValue({ sessions: [], drills: [], swimmers: [], libraryDrills: [] })

    const user = userEvent.setup()
    renderPage()

    const select = await screen.findByLabelText('Select coach')
    expect(select).toBeTruthy()

    await user.selectOptions(select, 'c1')
    await user.click(screen.getByText('Add swimmer'))

    await waitFor(() => expect(screen.getByText('New Athlete')).toBeTruthy())
  })
})
