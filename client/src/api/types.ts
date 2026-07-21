// Shared DTO types for lane-result projection. The canonical definitions live
// in `db/schema` (data model); this module re-exports them through the api
// boundary so pages/components can use them without importing `db/` directly.
export type { LapEntry, SavedSwimmerData, SavedDrillData } from '../db/schema'
