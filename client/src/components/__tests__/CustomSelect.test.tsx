// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CustomSelect } from '../CustomSelect'

afterEach(cleanup)

const options = [
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'backstroke', label: 'Backstroke' },
]

describe('CustomSelect', () => {
  it('renders the selected label as button text', () => {
    render(<CustomSelect options={options} value="freestyle" onChange={() => {}} />)
    expect(screen.getByText('Freestyle')).toBeTruthy()
  })

  it('renders all options when opened', async () => {
    const user = userEvent.setup()
    render(<CustomSelect options={options} value="freestyle" onChange={() => {}} />)
    const button = screen.getByRole('button')
    await user.click(button)
    expect(screen.getByText('Backstroke')).toBeTruthy()
    expect(screen.getAllByText('Freestyle')).toHaveLength(2)
  })

  it('calls onChange when user selects an option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CustomSelect options={options} value="freestyle" onChange={onChange} />)
    const button = screen.getByRole('button')
    await user.click(button)
    const backstrokeBtn = screen.getByText('Backstroke')
    await user.click(backstrokeBtn)
    expect(onChange).toHaveBeenCalledWith('backstroke')
  })

  it('applies custom className', () => {
    const { container } = render(<CustomSelect options={options} value="freestyle" onChange={() => {}} className="my-custom-class" />)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('my-custom-class')
  })
})
