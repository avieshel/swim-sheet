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

  it('pre-fills fields in edit mode', () => {
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
    const descInput = screen.getByPlaceholderText(/6-1-6 breathing/) as HTMLTextAreaElement
    expect(descInput.value).toBe('Some description')
  })
})
