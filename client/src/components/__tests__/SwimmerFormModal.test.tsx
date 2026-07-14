// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SwimmerFormModal } from '../SwimmerFormModal'

afterEach(cleanup)

describe('SwimmerFormModal', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <SwimmerFormModal open={false} editingId={null} onSave={vi.fn()} onClose={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders with "New Athlete" title when no editingId', () => {
    render(<SwimmerFormModal open={true} editingId={null} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('New Athlete')).toBeTruthy()
  })

  it('renders with "Edit Athlete" title when editingId is provided', () => {
    render(
      <SwimmerFormModal
        open={true}
        editingId="abc"
        initialData={{ name: 'Alex Rivera', group: 'U17', notes: 'Freestyle' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Edit Athlete')).toBeTruthy()
  })

  it('pre-fills input fields in edit mode', () => {
    const { container } = render(
      <SwimmerFormModal
        open={true}
        editingId="abc"
        initialData={{ name: 'Alex Rivera', group: 'U17', notes: 'Freestyle' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const nameInput = container.querySelectorAll('input[type="text"]')[0] as HTMLInputElement
    expect(nameInput.value).toBe('Alex Rivera')
    const groupInput = container.querySelectorAll('input[type="text"]')[1] as HTMLInputElement
    expect(groupInput.value).toBe('U17')
    const notesInput = container.querySelectorAll('input[type="text"]')[2] as HTMLInputElement
    expect(notesInput.value).toBe('Freestyle')
  })

  it('calls onSave with form data on submit', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { container } = render(<SwimmerFormModal open={true} editingId={null} onSave={onSave} onClose={vi.fn()} />)
    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement
    await user.type(nameInput, 'Test Swimmer')
    const submitBtn = screen.getByText('Add Swimmer')
    await user.click(submitBtn)
    expect(onSave).toHaveBeenCalledWith({ name: 'Test Swimmer', group: '', notes: '', status: 'active' })
  })

  it('calls onClose on cancel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SwimmerFormModal open={true} editingId={null} onSave={vi.fn()} onClose={onClose} />)
    const cancelBtn = screen.getByText('Cancel')
    await user.click(cancelBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
