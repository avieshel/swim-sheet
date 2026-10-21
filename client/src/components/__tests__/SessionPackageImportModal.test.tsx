// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockApi = vi.hoisted(() => ({
  inspectSessionPackage: vi.fn(),
  importSessionPackage: vi.fn(),
}))
const mockFile = vi.hoisted(() => ({ readSessionPackageFile: vi.fn() }))

vi.mock('../../api/sessionPackages', () => mockApi)
vi.mock('../../utils/sessionPackageFile', () => mockFile)

import { SessionPackageImportModal } from '../SessionPackageImportModal'

const packageData = {
  format: 'swimsheet-session',
  version: 1,
  exportedAt: '2026-10-21T12:00:00.000Z',
  creator: { label: 'Coach A' },
  session: { name: 'Aerobic Set', notes: 'Steady effort' },
  drills: [
    {
      name: 'Freestyle',
      stroke: 'freestyle',
      distance: 100,
      order: 0,
      items: [{ distance: 50, stroke: 'freestyle', repeatCount: 2 }],
      repeatCount: 1,
      timingMode: 'individual',
      focus: 'fitness',
      labels: [],
      description: '',
    },
  ],
}

function renderModal(props: Partial<React.ComponentProps<typeof SessionPackageImportModal>> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onImported: vi.fn(),
    onViewSession: vi.fn(),
    ...props,
  }
  render(<SessionPackageImportModal {...handlers} />)
  return handlers
}

async function selectFile(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText('Session file'), new File(['{}'], 'a.swimsheet'))
}

describe('SessionPackageImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFile.readSessionPackageFile.mockResolvedValue(packageData)
    mockApi.inspectSessionPackage.mockResolvedValue({
      outcome: 'ready',
      package: packageData,
      nameConflict: false,
      suggestedName: null,
    })
    mockApi.importSessionPackage.mockResolvedValue({ outcome: 'created', sessionId: 'imported-session' })
  })

  afterEach(cleanup)

  it('previews the selected package without writing before confirmation', async () => {
    const user = userEvent.setup()
    renderModal()

    await selectFile(user)

    expect(await screen.findByRole('heading', { name: 'Aerobic Set' })).toBeTruthy()
    expect(screen.getByText('1 drill · 100m')).toBeTruthy()
    expect(screen.getByText('Shared by Coach A')).toBeTruthy()
    expect(mockApi.importSessionPackage).not.toHaveBeenCalled()
  })

  it('shows file and package errors near the file input', async () => {
    const user = userEvent.setup()
    mockFile.readSessionPackageFile.mockRejectedValueOnce(new Error('The selected file exceeds the session package size limit.'))
    renderModal()

    await selectFile(user)

    expect((await screen.findByRole('alert')).textContent).toMatch(/size limit/i)
    mockFile.readSessionPackageFile.mockResolvedValueOnce({ format: 'swimsheet-session', version: 1 })
    mockApi.inspectSessionPackage.mockResolvedValueOnce({
      outcome: 'invalid',
      error: { code: 'invalid_shape', message: 'The package is missing a session.' },
    })
    await selectFile(user)
    expect((await screen.findByRole('alert')).textContent).toMatch(/missing a session/i)
    expect(mockApi.importSessionPackage).not.toHaveBeenCalled()
  })

  it('offers the suggested copy name or cancel on a name conflict', async () => {
    const user = userEvent.setup()
    mockApi.inspectSessionPackage.mockResolvedValue({
      outcome: 'ready',
      package: packageData,
      nameConflict: true,
      suggestedName: 'Aerobic Set (imported)',
    })
    const handlers = renderModal()

    await selectFile(user)

    const importCopy = await screen.findByRole('button', { name: 'Import as Aerobic Set (imported)' })
    await user.click(importCopy)
    expect(mockApi.importSessionPackage).toHaveBeenCalledWith(packageData, 'Aerobic Set (imported)')
    expect(await screen.findByRole('heading', { name: 'Import Complete' })).toBeTruthy()
    expect(handlers.onImported).toHaveBeenCalledExactlyOnceWith('imported-session')
  })

  it('cancel closes without calling import', async () => {
    const user = userEvent.setup()
    const handlers = renderModal()

    await selectFile(user)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(handlers.onClose).toHaveBeenCalledOnce()
    expect(mockApi.importSessionPackage).not.toHaveBeenCalled()
  })

  it('imports only after confirmation and shows View session', async () => {
    const user = userEvent.setup()
    const handlers = renderModal()

    await selectFile(user)
    expect(mockApi.importSessionPackage).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Import session' }))
    expect(mockApi.importSessionPackage).toHaveBeenCalledWith(packageData, 'Aerobic Set')
    await user.click(await screen.findByRole('button', { name: 'View session' }))
    expect(handlers.onViewSession).toHaveBeenCalledExactlyOnceWith('imported-session')
  })

  it('uses a named keyboard-dismissible dialog with visible focus', async () => {
    const user = userEvent.setup()
    const handlers = renderModal()
    const dialog = screen.getByRole('dialog', { name: 'Import session' })

    expect(dialog).toBeTruthy()
    const fileInput = screen.getByLabelText('Session file')
    expect(fileInput).toBe(document.activeElement)
    expect(fileInput.className).toContain('focus-visible:ring-2')
    await user.keyboard('{Escape}')
    expect(handlers.onClose).toHaveBeenCalledOnce()
  })
})
