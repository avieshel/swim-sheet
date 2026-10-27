export type SessionPackageStroke = 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'im'
export type SessionPackageTimingMode = 'individual' | 'continuous'
export type SessionPackageFocus = 'technique' | 'fitness' | 'none'

export interface SessionPackageSegmentV1 {
  name: string
  distance: number
  stroke: SessionPackageStroke
}

export interface SessionPackageItemV1 {
  distance: number
  stroke: SessionPackageStroke
  repeatCount: number
  intensity?: string
  interval?: string
  equipment?: string[]
  segments?: SessionPackageSegmentV1[]
}

export interface SessionPackageDrillV1 {
  name: string
  stroke: SessionPackageStroke
  distance: number
  order: number
  items: SessionPackageItemV1[]
  repeatCount: number
  timingMode?: SessionPackageTimingMode
  focus: SessionPackageFocus
  labels: string[]
  description: string
}

export interface SessionPackageV1 {
  format: 'swimsheet-session'
  version: 1
  exportedAt: string
  creator?: { label?: string }
  session: { name: string; notes: string }
  drills: SessionPackageDrillV1[]
}

export type SessionPackageErrorCode = 'invalid_shape' | 'unsupported_version' | 'limit_exceeded'

export interface SessionPackageValidationError {
  code: SessionPackageErrorCode
  message: string
}

export type SessionPackageValidation =
  | { ok: true; value: SessionPackageV1 }
  | { ok: false; error: SessionPackageValidationError }

export interface SessionPackageLimits {
  maxFileBytes: number
  maxNameLength: number
  maxSessionNotesLength: number
  maxDescriptionLength: number
  maxIntervalLength: number
  maxLabelsPerDrill: number
  maxLabelLength: number
  maxDrills: number
  maxItemsPerDrill: number
  maxEquipmentPerItem: number
  maxEquipmentNameLength: number
  maxSegmentsPerItem: number
  maxDistance: number
  maxRepeatCount: number
}

export interface SessionPackageConfig {
  format: SessionPackageV1['format']
  version: SessionPackageV1['version']
  strokes: readonly SessionPackageStroke[]
  timingModes: readonly SessionPackageTimingMode[]
  focuses: readonly SessionPackageFocus[]
  limits: SessionPackageLimits
}
