// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'

const mockDexie = vi.hoisted(() => ({ liveQuery: vi.fn() }))

vi.mock('dexie', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dexie')>()
  return { ...actual, liveQuery: mockDexie.liveQuery }
})

import { useActiveRun } from '../useActiveRun'

describe('useActiveRun', () => {
  const unsubscribe = vi.fn()
  const subscribe = vi.fn(() => ({ unsubscribe }))

  beforeEach(() => {
    vi.clearAllMocks()
    mockDexie.liveQuery.mockReturnValue({ subscribe })
  })

  afterEach(cleanup)

  it('does not subscribe to Dexie when disabled and cleans up when disabled later', () => {
    const useActiveRunWithEnabled = useActiveRun as unknown as (enabled: boolean) => null
    const { result, rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => useActiveRunWithEnabled(enabled),
      { initialProps: { enabled: false } },
    )

    expect(result.current).toBeNull()
    expect(mockDexie.liveQuery).not.toHaveBeenCalled()

    rerender({ enabled: true })
    expect(mockDexie.liveQuery).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledOnce()

    rerender({ enabled: false })
    expect(unsubscribe).toHaveBeenCalledOnce()
    unmount()
  })
})
