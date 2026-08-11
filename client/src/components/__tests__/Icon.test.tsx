// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Icon, type IconSize, type IconColor } from '../Icon'

afterEach(() => cleanup())

describe('Icon', () => {
  it('renders with default props', () => {
    render(<Icon name="pool" />)
    const el = screen.getByText('pool')
    expect(el).toBeDefined()
    expect(el.className).toContain('material-symbols-outlined')
    expect(el.className).toContain('text-base')
  })

  it('applies correct size class for each size', () => {
    const sizes: { size: IconSize; expected: string }[] = [
      { size: 'xs', expected: 'text-xs' },
      { size: 'sm', expected: 'text-sm' },
      { size: 'md', expected: 'text-base' },
      { size: 'lg', expected: 'text-lg' },
      { size: 'xl', expected: 'text-2xl' },
      { size: '2xl', expected: 'text-3xl' },
      { size: '3xl', expected: 'text-4xl' },
      { size: '4xl', expected: 'text-5xl' },
    ]

    for (const { size, expected } of sizes) {
      render(<Icon name={`icon-${size}`} size={size} />)
      const el = screen.getByText(`icon-${size}`)
      expect(el.className).toContain(expected)
      cleanup()
    }
  })

  it('applies correct color class for each color', () => {
    const colors: { color: IconColor; expected: string }[] = [
      { color: 'primary', expected: 'text-primary' },
      { color: 'error', expected: 'text-error' },
      { color: 'on-surface-variant', expected: 'text-on-surface-variant' },
      { color: 'on-error', expected: 'text-on-error' },
      { color: 'current', expected: '' },
    ]

    for (const { color, expected } of colors) {
      render(<Icon name={`icon-${color}`} color={color} />)
      const el = screen.getByText(`icon-${color}`)
      if (expected) {
        expect(el.className).toContain(expected)
      }
      cleanup()
    }
  })

  it('applies fill style when fill is true', () => {
    render(<Icon name="bolt-filled" fill />)
    const el = screen.getByText('bolt-filled')
    expect(el.style.fontVariationSettings).toBe("'FILL' 1")
  })

  it('does not apply fill style when fill is false', () => {
    render(<Icon name="bolt-outline" />)
    const el = screen.getByText('bolt-outline')
    expect(el.style.fontVariationSettings).toBe('')
  })

  it('passes className through', () => {
    render(<Icon name="pool-custom" className="custom-class" />)
    const el = screen.getByText('pool-custom')
    expect(el.className).toContain('custom-class')
  })

  it('merges custom className with size/color classes', () => {
    render(<Icon name="pool-merged" size="lg" color="primary" className="custom-class" />)
    const el = screen.getByText('pool-merged')
    expect(el.className).toContain('text-lg')
    expect(el.className).toContain('text-primary')
    expect(el.className).toContain('custom-class')
  })
})
