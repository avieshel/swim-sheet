// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useContext } from 'react'
import { LiveSessionProvider } from '../../context/LiveSessionProvider'
import { LiveSessionContext } from '../../context/LiveSessionContext'
import { useSmoothSessionElapsed } from '../useSmoothSessionElapsed'

function useHarness() {
  const ctx = useContext(LiveSessionContext)
  const smooth = useSmoothSessionElapsed()
  return { ...ctx, smooth }
}

describe('useSmoothSessionElapsed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-23T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns current elapsed on animation frames while running', () => {
    const { result } = renderHook(() => useHarness(), { wrapper: LiveSessionProvider })
    act(() => {
      result.current.dispatch({ type: 'START_SESSION_TIMER' })
    })
    act(() => {
      vi.setSystemTime(new Date('2026-11-23T10:00:00.120Z'))
      vi.advanceTimersByTime(100)
    })
    expect(result.current.smooth).toBeGreaterThanOrEqual(120)
  })

  it('returns session elapsed when not running', () => {
    const { result } = renderHook(() => useHarness(), { wrapper: LiveSessionProvider })
    expect(result.current.smooth).toBe(0)
  })
})
