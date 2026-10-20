// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { SessionDraftV1 } from '../../../../shared/sessionDraft/types'

const navigate = vi.fn()
const prepareSessionDraft = vi.fn()
const requestSessionDraftStream = vi.fn()
const applySessionDraft = vi.fn()
const getUnreviewedSessionDraft = vi.fn()
const keepSessionDraft = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', is_anonymous: false }, status: 'signed_in' }),
}))

vi.mock('../../api/sessionDraft', () => ({
  prepareSessionDraft: (...args: unknown[]) => prepareSessionDraft(...args),
  requestSessionDraftStream: (...args: unknown[]) => requestSessionDraftStream(...args),
  applySessionDraft: (...args: unknown[]) => applySessionDraft(...args),
  getUnreviewedSessionDraft: (...args: unknown[]) => getUnreviewedSessionDraft(...args),
  keepSessionDraft: (...args: unknown[]) => keepSessionDraft(...args),
}))

const { AiSessionDraft } = await import('../AiSessionDraft')

const sampleDraft: SessionDraftV1 = {
  schemaVersion: 1,
  session: { name: 'Aerobic 2000' },
  drills: [
    {
      name: 'Main set',
      repeatCount: 2,
      items: [{ distance: 100, stroke: 'freestyle', repeatCount: 10, intensity: 'v2', interval: '1:30' }],
    },
  ],
}

const prepared = {
  prompt: 'a sanitized description',
  seed: { schemaVersion: 1 as const, session: { name: '' }, drills: [] },
  context: {
    poolLength: 25,
    distanceUnits: 'meters',
    groupNames: [],
    equipmentOptions: [],
    recentSessions: [],
  },
  removedCategories: [],
  knownSwimmerNames: [],
}

function renderPage() {
  render(
    <MemoryRouter>
      <AiSessionDraft />
    </MemoryRouter>,
  )
}

async function generateDraft() {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Session description'), '2000m aerobic')
  await user.click(screen.getByRole('button', { name: /Review/ }))
  await screen.findByLabelText('Sanitized prompt')
  await user.click(screen.getByRole('button', { name: /Generate draft/ }))
}

beforeEach(() => {
  navigate.mockReset()
  prepareSessionDraft.mockReset().mockResolvedValue(prepared)
  requestSessionDraftStream.mockReset().mockImplementation(async (_prepared, handlers) => {
    handlers.onDone({ outcome: 'draft', draft: sampleDraft })
  })
  applySessionDraft.mockReset().mockResolvedValue({ outcome: 'created', sessionId: 'session-1' })
  getUnreviewedSessionDraft.mockReset().mockResolvedValue(null)
})

afterEach(cleanup)

describe('AiSessionDraft', () => {
  it('exposes the AI composer inside a named editor section', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Create with AI' })
    expect(screen.getByRole('region', { name: 'Create with AI' })).toBeTruthy()
  })

  it('shows the proposal beside the prompt without saving anything', async () => {
    renderPage()
    await generateDraft()
    expect(await screen.findByText('Proposed session')).toBeTruthy()
    expect((screen.getByLabelText('Session name') as HTMLInputElement).value).toBe('Aerobic 2000')
    expect(applySessionDraft).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('saves and opens the session when the coach confirms', async () => {
    const user = userEvent.setup()
    renderPage()
    await generateDraft()
    await user.click(await screen.findByRole('button', { name: /Save session/ }))
    await waitFor(() => expect(applySessionDraft).toHaveBeenCalledWith(sampleDraft))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/sessions/session-1'))
  })

  it('saves the edited proposal rather than the generated one', async () => {
    const user = userEvent.setup()
    renderPage()
    await generateDraft()
    const reps = await screen.findByLabelText('Reps for Main set')
    await user.clear(reps)
    await user.type(reps, '8')
    await user.click(screen.getByRole('button', { name: /Save session/ }))
    await waitFor(() => {
      const [saved] = applySessionDraft.mock.calls[0]
      expect(saved.drills[0].items[0].repeatCount).toBe(8)
    })
  })

  it('drops the proposal when the coach discards it', async () => {
    const user = userEvent.setup()
    renderPage()
    await generateDraft()
    await user.click(await screen.findByRole('button', { name: 'Discard proposal' }))
    expect(screen.queryByText('Proposed session')).toBeNull()
    expect(applySessionDraft).not.toHaveBeenCalled()
  })

  it('leaves the proposal empty until a draft is generated', async () => {
    renderPage()
    await screen.findByLabelText('Session description')
    expect(screen.queryByText('Proposed session')).toBeNull()
  })
})
