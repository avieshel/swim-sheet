import {
  addSessionWithDrills,
  getAllSessions,
  getDrillsForSession,
  getSession,
} from '../db/dao'
import type { Drill, SafeDrill, SafeSession } from '../db/schema'
import { defaultSessionPackageConfig } from '../../../shared/sessionPackage/config'
import { getDrillTotalDistance } from '../utils/drillHelpers'
import type {
  SessionPackageDrillV1,
  SessionPackageItemV1,
  SessionPackageV1,
  SessionPackageValidationError,
} from '../../../shared/sessionPackage/types'
import { validateSessionPackage } from '../../../shared/sessionPackage/validate'

export type SessionPackageInspection =
  | {
      outcome: 'ready'
      package: SessionPackageV1
      nameConflict: boolean
      suggestedName: string | null
    }
  | { outcome: 'invalid'; error: SessionPackageValidationError }

export type ImportSessionPackageResult =
  | { outcome: 'created'; sessionId: string }
  | { outcome: 'name_conflict'; suggestedName: string }
  | { outcome: 'invalid'; error: SessionPackageValidationError }

function mapItem(item: Drill['items'][number]): SessionPackageItemV1 {
  const mapped: SessionPackageItemV1 = {
    distance: item.distance,
    stroke: item.stroke,
    repeatCount: item.repeatCount,
  }
  if (item.intensity !== undefined) mapped.intensity = item.intensity
  if (item.interval !== undefined) mapped.interval = item.interval
  if (item.equipment !== undefined) mapped.equipment = [...item.equipment]
  if (item.segments !== undefined) {
    mapped.segments = item.segments.map((segment) => ({
      name: segment.name,
      distance: segment.distance,
      stroke: segment.stroke,
    }))
  }
  return mapped
}

function mapDrill(drill: Drill): SessionPackageDrillV1 {
  const stroke = drill.stroke || drill.items[0]?.stroke
  if (!stroke) throw new Error(`Drill "${drill.name}" has no stroke to export`)
  return {
    name: drill.name,
    stroke,
    distance: drill.distance ?? getDrillTotalDistance(drill),
    order: drill.order,
    items: drill.items.map(mapItem),
    repeatCount: drill.repeatCount,
    timingMode: drill.timingMode,
    focus: drill.focus,
    labels: [...drill.labels],
    description: drill.description,
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

function isNameTaken(name: string, existingNames: string[]): boolean {
  const normalized = normalizeName(name)
  return existingNames.some((existing) => normalizeName(existing) === normalized)
}

function suggestName(name: string, existingNames: string[]): string {
  const maxLength = defaultSessionPackageConfig.limits.maxNameLength
  const base = name.trim()
  let suffix = ' (imported)'
  let sequence = 1
  while (true) {
    const availableBaseLength = Math.max(0, maxLength - suffix.length)
    const candidate = `${base.slice(0, availableBaseLength).trimEnd()}${suffix}`
    if (!isNameTaken(candidate, existingNames)) return candidate
    sequence += 1
    suffix = ` (imported ${sequence})`
  }
}

function invalidName(message: string, code: SessionPackageValidationError['code']): ImportSessionPackageResult {
  return { outcome: 'invalid', error: { code, message } }
}

function mapImportedDrill(drill: SessionPackageDrillV1): Omit<SafeDrill, 'sessionId'> {
  return {
    name: drill.name,
    stroke: drill.stroke,
    distance: drill.distance,
    order: drill.order,
    items: drill.items.map((item) => ({
      id: crypto.randomUUID(),
      distance: item.distance,
      stroke: item.stroke,
      repeatCount: item.repeatCount,
      intensity: item.intensity,
      interval: item.interval,
      equipment: item.equipment ? [...item.equipment] : undefined,
      segments: item.segments?.map((segment) => ({ ...segment })),
    })),
    repeatCount: drill.repeatCount,
    timingMode: drill.timingMode,
    focus: drill.focus,
    labels: [...drill.labels],
    description: drill.description,
  }
}

export async function exportSessionPackage(sessionId: string): Promise<SessionPackageV1> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  const drills = (await getDrillsForSession(sessionId))
    .sort((a, b) => a.order - b.order)
    .map(mapDrill)
  const validation = validateSessionPackage({
    format: defaultSessionPackageConfig.format,
    version: defaultSessionPackageConfig.version,
    exportedAt: new Date().toISOString(),
    session: { name: session.name, notes: session.notes },
    drills,
  })
  if (!validation.ok) throw new Error(validation.error.message)
  return validation.value
}

export async function inspectSessionPackage(input: unknown): Promise<SessionPackageInspection> {
  const validation = validateSessionPackage(input)
  if (!validation.ok) return { outcome: 'invalid', error: validation.error }
  const existingNames = (await getAllSessions()).map((session) => session.name)
  const name = validation.value.session.name
  const nameConflict = isNameTaken(name, existingNames)
  return {
    outcome: 'ready',
    package: validation.value,
    nameConflict,
    suggestedName: nameConflict ? suggestName(name, existingNames) : null,
  }
}

export async function importSessionPackage(
  input: unknown,
  name: string,
): Promise<ImportSessionPackageResult> {
  const validation = validateSessionPackage(input)
  if (!validation.ok) return { outcome: 'invalid', error: validation.error }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return invalidName('Session name must not be empty', 'invalid_shape')
  }
  if (name.length > defaultSessionPackageConfig.limits.maxNameLength) {
    return invalidName(
      `Session name exceeds ${defaultSessionPackageConfig.limits.maxNameLength} characters`,
      'limit_exceeded',
    )
  }

  const importName = name.trim()
  const existingNames = (await getAllSessions()).map((session) => session.name)
  if (isNameTaken(importName, existingNames)) {
    return { outcome: 'name_conflict', suggestedName: suggestName(importName, existingNames) }
  }

  const session: SafeSession = {
    name: importName,
    notes: validation.value.session.notes,
    visibility: 'private',
    assignedTo: null,
  }
  const drills = validation.value.drills.map(mapImportedDrill)
  const sessionId = await addSessionWithDrills(session, drills)
  return { outcome: 'created', sessionId }
}

export const sessionPackageService = {
  exportSessionPackage,
  inspectSessionPackage,
  importSessionPackage,
}
