// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAdminStatus } from './useAdminStatus'

vi.mock('./adminCoachService', () => ({
  getAdminStatus: vi.fn(),
}))

import { getAdminStatus } from './adminCoachService'

const mockGet = getAdminStatus as unknown as ReturnType<typeof vi.fn>

describe('useAdminStatus', () => {
  test('reports loading then isOwner:false when the status resolves false', async () => {
    mockGet.mockResolvedValue({ isOwner: false })
    const { result } = renderHook(() => useAdminStatus())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOwner).toBe(false)
  })

  test('reports isOwner:true when the status resolves true', async () => {
    mockGet.mockResolvedValue({ isOwner: true })
    const { result } = renderHook(() => useAdminStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOwner).toBe(true)
  })

  test('reports isOwner:false when the status call rejects', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useAdminStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOwner).toBe(false)
  })
})
