// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'

const mockTrack = vi.hoisted(() => vi.fn())

vi.mock('../../services/analyticsEvents', () => ({
  analytics: { track: mockTrack },
}))

import { useTrackDwell } from '../useTrackDwell'

describe('useTrackDwell', () => {
  afterEach(() => {
    cleanup()
    mockTrack.mockReset()
    vi.useRealTimers()
  })

  it('tracks dwell event on unmount', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-23T10:00:00Z'))

    const { unmount } = renderHook(() =>
      useTrackDwell((dwellMs) => ({ name: 'view_exited', properties: { dwell_ms: dwellMs } }))
    )

    vi.advanceTimersByTime(1500)
    unmount()

    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith({
      name: 'view_exited',
      properties: { dwell_ms: 1500 },
    })
  })
})
