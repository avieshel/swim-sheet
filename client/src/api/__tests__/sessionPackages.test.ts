import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

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

describe('session package API — delegation to sessionPackageService', () => {
  beforeEach(() => vi.clearAllMocks())

  type Delegation = {
    name: string
    run: () => Promise<unknown>
    mock: Mock
    calledWith: unknown[]
    ret: unknown
  }

  const expectedExport = { format: 'swimsheet-session', version: 1 } as SessionPackageV1
  const inspectInput = { format: 'swimsheet-session' }
  const inspectResult = { outcome: 'invalid' }
  const importInput = { format: 'swimsheet-session' }
  const importResult = { outcome: 'created', sessionId: 'new-session' }

  const cases: Delegation[] = [
    {
      name: 'exportSessionPackage → exportSessionPackage',
      run: () => exportSessionPackage('session-1'),
      mock: mockService.exportSessionPackage,
      calledWith: ['session-1'],
      ret: expectedExport,
    },
    {
      name: 'inspectSessionPackage → inspectSessionPackage',
      run: () => inspectSessionPackage(inspectInput),
      mock: mockService.inspectSessionPackage,
      calledWith: [inspectInput],
      ret: inspectResult,
    },
    {
      name: 'importSessionPackage → importSessionPackage',
      run: () => importSessionPackage(importInput, 'Imported Copy'),
      mock: mockService.importSessionPackage,
      calledWith: [importInput, 'Imported Copy'],
      ret: importResult,
    },
  ]

  it.each(cases)('$name', async (c) => {
    c.mock.mockResolvedValue(c.ret)
    const result = await c.run()
    expect(c.mock).toHaveBeenCalledExactlyOnceWith(...c.calledWith)
    expect(result).toBe(c.ret)
  })
})
