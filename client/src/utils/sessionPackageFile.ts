import { defaultSessionPackageConfig } from '../../../shared/sessionPackage/config'
import type { SessionPackageV1 } from '../../../shared/sessionPackage/types'

export async function readSessionPackageFile(file: File): Promise<unknown> {
  if (file.size > defaultSessionPackageConfig.limits.maxFileBytes) {
    throw new Error('The selected file exceeds the session package size limit.')
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    throw new Error('The selected file could not be read.')
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }
}

function sessionFilename(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'session'}.swimsheet`
}

export function downloadSessionPackageFile(
  sessionPackage: SessionPackageV1,
  sessionName: string,
): void {
  const blob = new Blob([JSON.stringify(sessionPackage, null, 2)], { type: 'application/json' })
  if (blob.size > defaultSessionPackageConfig.limits.maxFileBytes) {
    throw new Error('The exported session exceeds the session package size limit.')
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sessionFilename(sessionName)
  anchor.style.display = 'none'
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(url)
  }
}
