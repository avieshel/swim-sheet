import {
  sessionPackageService,
  type ImportSessionPackageResult,
  type SessionPackageInspection,
} from '../services/sessionPackageService'
import type { SessionPackageV1 } from '../../../shared/sessionPackage/types'

export function exportSessionPackage(sessionId: string): Promise<SessionPackageV1> {
  return sessionPackageService.exportSessionPackage(sessionId)
}

export function inspectSessionPackage(input: unknown): Promise<SessionPackageInspection> {
  return sessionPackageService.inspectSessionPackage(input)
}

export function importSessionPackage(
  input: unknown,
  name: string,
): Promise<ImportSessionPackageResult> {
  return sessionPackageService.importSessionPackage(input, name)
}
