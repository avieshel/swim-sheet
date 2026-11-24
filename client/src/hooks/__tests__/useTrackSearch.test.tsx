// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'

const mockTrack = vi.hoisted(() => vi.fn())

vi.mock('../../services/analyticsEvents', () => ({
  ANALYTICS_SEARCH_DEBOUNCE_MS: 800,
  Events: {
    SearchPerformed: (scope: string, resultCount: number) => ({
      name: 'search_performed',
      properties: { scope, result_count: resultCount },
    }),
  },
  analytics: { track: mockTrack },
}))

import { useTrackSearch } from '../useTrackSearch'

describe('useTrackSearch', () => {
  afterEach(() => {
    cleanup()
    mockTrack.mockReset()
    vi.useRealTimers()
  })

  it('tracks once per signature after debounce', () => {
    vi.useFakeTimers()
    const { rerender } = renderHook(
      ({ signature, count }: { signature: string; count: number | null }) =>
        useTrackSearch('swimmers', signature, count),
      { initialProps: { signature: 'ali', count: 2 } },
    )

    vi.advanceTimersByTime(799)
    expect(mockTrack).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(mockTrack).toHaveBeenCalledTimes(1)

    rerender({ signature: 'ali', count: 5 })
    vi.advanceTimersByTime(800)
    expect(mockTrack).toHaveBeenCalledTimes(1)

    rerender({ signature: 'alic', count: 1 })
    vi.advanceTimersByTime(800)
    expect(mockTrack).toHaveBeenCalledTimes(2)
  })

  it('resets when signature becomes inactive', () => {
    vi.useFakeTimers()
    const { rerender } = renderHook(
      ({ signature, count }: { signature: string; count: number | null }) =>
        useTrackSearch('sessions', signature, count),
      { initialProps: { signature: 'end', count: 3 } },
    )

    vi.advanceTimersByTime(800)
    expect(mockTrack).toHaveBeenCalledTimes(1)

    rerender({ signature: '', count: 3 })
    rerender({ signature: 'end', count: 3 })
    vi.advanceTimersByTime(800)
    expect(mockTrack).toHaveBeenCalledTimes(2)
  })
})
