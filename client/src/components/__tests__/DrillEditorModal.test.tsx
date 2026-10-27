// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrillEditorModal } from '../DrillEditorModal'

afterEach(cleanup)

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => '00000000-0000-0000-0000-000000000001' },
      writable: true,
    })
  }
})

describe('DrillEditorModal', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <DrillEditorModal open={false} title="Create Drill" onSave={vi.fn()} onClose={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders with the given title', () => {
    const { container } = render(<DrillEditorModal open={true} title="Create Drill" onSave={vi.fn()} onClose={vi.fn()} />)
    expect(container.querySelector('h2')?.textContent).toBe('Create Drill')
  })

  it('calls onSave when the save button is clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<DrillEditorModal open={true} title="Create Drill" onSave={onSave} onClose={vi.fn()} />)
    const nameInput = screen.getByPlaceholderText(/e\.g\. Pyramid Set/)
    await user.type(nameInput, 'Test Drill')
    const saveBtns = screen.getAllByText('Create Drill')
    const saveBtn = saveBtns[1]
    await user.click(saveBtn)
    expect(onSave).toHaveBeenCalledOnce()
    const data = onSave.mock.calls[0][0]
    expect(data.name).toBe('Test Drill')
    expect(data.items).toHaveLength(1)
    expect(data.items[0].stroke).toBe('freestyle')
  })

  it('calls onClose on cancel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<DrillEditorModal open={true} title="Create Drill" onSave={vi.fn()} onClose={onClose} />)
    const cancelBtn = screen.getByText('Cancel')
    await user.click(cancelBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('pre-fills fields in edit mode', async () => {
    render(
      <DrillEditorModal
        open={true}
        title="Edit Drill"
        initialData={{
          name: 'Pre-existing Drill',
          description: 'Some description',
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const nameInput = screen.getByPlaceholderText(/e\.g\. Pyramid Set/) as HTMLInputElement
    expect(nameInput.value).toBe('Pre-existing Drill')
    const detailsToggle = screen.getByRole('button', { name: /Description & Tags/ })
    await userEvent.setup().click(detailsToggle)
    const descInput = screen.getByPlaceholderText(/6-1-6 breathing/) as HTMLTextAreaElement
    expect(descInput.value).toBe('Some description')
  })

  it('keeps the drill editor open when Escape dismisses the stroke confirmation', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <DrillEditorModal
        open={true}
        title="Edit Drill"
        initialData={{
          id: 'drill-1',
          name: 'Stroke set',
          stroke: 'freestyle',
          items: [{ id: 'step-1', distance: 100, stroke: 'freestyle', repeatCount: 1 }],
        }}
        onSave={vi.fn()}
        onClose={onClose}
      />
    )

    await user.click(screen.getByRole('button', { name: /Freestyle/ }))
    await user.click(screen.getByRole('button', { name: 'Breaststroke' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(screen.getByText('Stroke Changed')).toBeTruthy()

    await user.keyboard('{Escape}')

    expect(screen.queryByText('Stroke Changed')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Edit Drill' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Breaststroke/ })).toBeTruthy()
  })

  it('associates visible labels with the step reps and interval controls', () => {
    render(<DrillEditorModal open={true} title="Create Drill" onSave={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByLabelText('Reps')).toBeTruthy()
    expect(screen.getByLabelText('Interval')).toBeTruthy()
  })
})
