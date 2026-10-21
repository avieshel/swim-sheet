import type { SessionPackageConfig } from './types.ts'

export const defaultSessionPackageConfig: SessionPackageConfig = {
  format: 'swimsheet-session',
  version: 1,
  strokes: ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'im'],
  timingModes: ['individual', 'continuous'],
  focuses: ['technique', 'fitness', 'none'],
  limits: {
    maxFileBytes: 1_048_576,
    maxNameLength: 100,
    maxSessionNotesLength: 4_000,
    maxDescriptionLength: 400,
    maxIntervalLength: 40,
    maxLabelsPerDrill: 20,
    maxLabelLength: 64,
    maxDrills: 100,
    maxItemsPerDrill: 100,
    maxEquipmentPerItem: 16,
    maxEquipmentNameLength: 64,
    maxSegmentsPerItem: 100,
    maxDistance: 10_000,
    maxRepeatCount: 100,
  },
}
