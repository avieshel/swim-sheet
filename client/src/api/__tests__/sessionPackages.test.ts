import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockService = vi.hoisted(() => ({
  exportSessionPackage: vi.fn(),
  inspectSessionPackage: vi.fn(),
  importSessionPackage: vi.fn(),
}))

vi.mock('../../services/sessionPackageService', () => ({ sessionPackageService: mockService }))

import {
  exportSessionPackage,
  importSessionPackage,
  inspectSessionPackage,
} from '../sessionPackages'
import type { SessionPackageV1 } from '../../../../shared/sessionPackage/types'

describe('session package API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates export to the package service', async () => {
    const expected = { format: 'swimsheet-session', version: 1 } as SessionPackageV1
    mockService.exportSessionPackage.mockResolvedValue(expected)

    await expect(exportSessionPackage('session-1')).resolves.toBe(expected)
    expect(mockService.exportSessionPackage).toHaveBeenCalledExactlyOnceWith('session-1')
  })

  it('delegates package inspection to the package service', async () => {
    const input = { format: 'swimsheet-session' }
    const expected = { outcome: 'invalid' }
    mockService.inspectSessionPackage.mockResolvedValue(expected)

    await expect(inspectSessionPackage(input)).resolves.toBe(expected)
    expect(mockService.inspectSessionPackage).toHaveBeenCalledExactlyOnceWith(input)
  })

  it('delegates import with the confirmed session name', async () => {
    const input = { format: 'swimsheet-session' }
    const expected = { outcome: 'created', sessionId: 'new-session' }
    mockService.importSessionPackage.mockResolvedValue(expected)

    await expect(importSessionPackage(input, 'Imported Copy')).resolves.toBe(expected)
    expect(mockService.importSessionPackage).toHaveBeenCalledExactlyOnceWith(input, 'Imported Copy')
  })
})
