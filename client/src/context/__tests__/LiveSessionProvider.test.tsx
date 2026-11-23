// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useContext } from 'react'
import { LiveSessionProvider } from '../LiveSessionProvider'
import { LiveSessionContext } from '../LiveSessionContext'

function useLive() {
  return useContext(LiveSessionContext)
}

describe('LiveSessionProvider wall-clock timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-23T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('advances elapsed from wall clock while running', () => {
    const { result } = renderHook(() => useLive(), { wrapper: LiveSessionProvider })
    act(() => {
      result.current.dispatch({ type: 'START_SESSION_TIMER' })
    })
    act(() => {
      vi.setSystemTime(new Date('2026-11-23T10:00:05.000Z'))
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.sessionElapsed).toBeGreaterThanOrEqual(5000)
  })

  it('does not count paused wall-clock time', () => {
    const { result } = renderHook(() => useLive(), { wrapper: LiveSessionProvider })
    act(() => {
      result.current.dispatch({ type: 'START_SESSION_TIMER' })
    })
    act(() => {
      vi.setSystemTime(new Date('2026-11-23T10:00:05.000Z'))
      vi.advanceTimersByTime(1000)
    })
    const paused = result.current.sessionElapsed
    act(() => {
      result.current.dispatch({ type: 'PAUSE_SESSION_TIMER' })
    })
    act(() => {
      vi.setSystemTime(new Date('2026-11-23T10:00:30.000Z'))
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.sessionElapsed).toBe(paused)
    expect(result.current.sessionElapsed).toBeGreaterThanOrEqual(5000)
  })

  it('keeps elapsed correct after background interval gap', () => {
    const { result } = renderHook(() => useLive(), { wrapper: LiveSessionProvider })
    act(() => {
      result.current.dispatch({ type: 'START_SESSION_TIMER' })
    })
    act(() => {
      vi.setSystemTime(new Date('2026-11-23T10:02:00.000Z'))
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.sessionElapsed).toBeGreaterThanOrEqual(120000)
  })

  it('does not move elapsed backward when wall clock jumps backward', () => {
    const { result } = renderHook(() => useLive(), { wrapper: LiveSessionProvider })
    act(() => {
      result.current.dispatch({ type: 'START_SESSION_TIMER' })
    })
    act(() => {
      vi.setSystemTime(new Date('2026-11-23T10:00:10.000Z'))
      vi.advanceTimersByTime(1000)
    })
    const beforeJump = result.current.sessionElapsed
    act(() => {
      vi.setSystemTime(new Date('2026-11-23T10:00:03.000Z'))
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.sessionElapsed).toBeGreaterThanOrEqual(beforeJump)
  })

  it('recomputes elapsed on visibilitychange when becoming visible', () => {
    const { result } = renderHook(() => useLive(), { wrapper: LiveSessionProvider })
    act(() => {
      result.current.dispatch({ type: 'START_SESSION_TIMER' })
    })
    act(() => {
      vi.setSystemTime(new Date('2026-11-23T10:00:45.000Z'))
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.sessionElapsed).toBeGreaterThanOrEqual(45000)
  })
})
