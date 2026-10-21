// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSessionPackageConfig } from '../../../../shared/sessionPackage/config'
import type { SessionPackageV1 } from '../../../../shared/sessionPackage/types'
import {
  downloadSessionPackageFile,
  readSessionPackageFile,
} from '../sessionPackageFile'

const packageData: SessionPackageV1 = {
  format: 'swimsheet-session',
  version: 1,
  exportedAt: '2026-10-21T12:00:00.000Z',
  session: { name: 'Main Set', notes: '' },
  drills: [],
}

afterEach(() => vi.restoreAllMocks())

describe('session package file helpers', () => {
  it('rejects oversize files before reading text', async () => {
    const file = new File(
      [new Uint8Array(defaultSessionPackageConfig.limits.maxFileBytes + 1)],
      'large.swimsheet',
    )
    const text = vi.fn().mockResolvedValue('{}')
    Object.defineProperty(file, 'text', { value: text })

    await expect(readSessionPackageFile(file)).rejects.toThrow(/size limit/i)
    expect(text).not.toHaveBeenCalled()
  })

  it('returns parsed JSON as unknown data regardless of filename extension', async () => {
    const file = new File(['{"session":"portable"}'], 'session.json')

    await expect(readSessionPackageFile(file)).resolves.toEqual({ session: 'portable' })
  })

  it('reports malformed JSON', async () => {
    const file = new File(['{bad json'], 'session.swimsheet')

    await expect(readSessionPackageFile(file)).rejects.toThrow(/valid json/i)
  })

  it('rejects oversized exports before creating a download URL', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:session-package')
    const oversizedPackage: SessionPackageV1 = {
      ...packageData,
      session: {
        ...packageData.session,
        notes: 'n'.repeat(defaultSessionPackageConfig.limits.maxFileBytes),
      },
    }

    expect(() => downloadSessionPackageFile(oversizedPackage, 'Large Set')).toThrow(/size limit/i)
    expect(createObjectURL).not.toHaveBeenCalled()
    createObjectURL.mockRestore()
  })

  it('downloads a JSON file with the swimsheet extension', () => {
    let downloadedBlob: Blob | undefined
    let downloadedFilename = ''
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      downloadedBlob = blob
      return 'blob:session-package'
    })
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFilename = this.download
    })

    downloadSessionPackageFile(packageData, '  Main Set / Specialty  ')

    expect(downloadedBlob?.type).toBe('application/json')
    expect(downloadedFilename).toBe('main-set-specialty.swimsheet')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:session-package')
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    click.mockRestore()
  })

  it('uses a stable fallback filename when the name has no usable characters', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:session-package')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    let downloadedFilename = ''
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFilename = this.download
    })

    downloadSessionPackageFile(packageData, ' / ')

    expect(downloadedFilename).toBe('session.swimsheet')
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    click.mockRestore()
  })
})
