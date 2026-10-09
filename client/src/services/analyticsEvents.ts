// Central registry for all analytics events. Call sites use:
//   import { Events, analytics } from '../services/analyticsEvents'
//   analytics.track(Events.ViewSwimmers(swimmers.length))
// Event names and payload construction live together so they cannot drift.

import type { TrackedEvent } from './analyticsService'

export type SwimmerSource = 'roster' | 'live_session'
export type SwimmerManageSource = 'roster' | 'profile'
export type DrillSource = 'library' | 'session'
export type DrillAddedSource = 'drill_bank' | 'session_detail'
export type RunFilter = 'all' | 'swimmer'

interface SessionCompletionStats {
  swimmerCount: number
  lapCount: number
  drillCount: number
  totalDistance: number
  durationMs: number
  isQuickStart: boolean
}

interface StartDrillStats {
  drillCount: number
  totalDistance: number
}

export const Events = {
  AppOpened: (): TrackedEvent => ({
    name: 'app_opened',
  }),
  ViewSwimmers: (swimmerCount: number): TrackedEvent => ({
    name: 'view_swimmers',
    properties: { swimmer_count: swimmerCount },
  }),
  ViewSwimmerProfile: (): TrackedEvent => ({
    name: 'view_swimmer_profile',
  }),
  ViewSessions: (templateCount: number, completedRunCount: number): TrackedEvent => ({
    name: 'view_sessions',
    properties: { template_count: templateCount, completed_run_count: completedRunCount },
  }),
  ViewSessionTemplate: (drillCount: number, totalDistance: number): TrackedEvent => ({
    name: 'view_session_template',
    properties: { drill_count: drillCount, total_distance: totalDistance },
  }),
  ViewDrillBank: (drillCount: number): TrackedEvent => ({
    name: 'view_drill_bank',
    properties: { drill_count: drillCount },
  }),
  ViewDashboard: (
    swimmerCount: number,
    templateCount: number,
    completedRunCount: number,
    lapCount: number
  ): TrackedEvent => ({
    name: 'view_dashboard',
    properties: {
      swimmer_count: swimmerCount,
      template_count: templateCount,
      completed_run_count: completedRunCount,
      lap_count: lapCount,
    },
  }),
  ViewRunsHistory: (runCount: number, swimmerFilter: RunFilter): TrackedEvent => ({
    name: 'view_runs_history',
    properties: { run_count: runCount, swimmer_filter: swimmerFilter },
  }),
  SwimmerCreated: (source: SwimmerSource, swimmerCount: number): TrackedEvent => ({
    name: 'swimmer_created',
    properties: { source, swimmer_count: swimmerCount },
  }),
  SwimmerUpdated: (source: SwimmerManageSource, swimmerCount?: number): TrackedEvent => ({
    name: 'swimmer_updated',
    properties:
      swimmerCount !== undefined ? { source, swimmer_count: swimmerCount } : { source },
  }),
  SwimmerDeleted: (source: SwimmerManageSource, swimmerCount?: number): TrackedEvent => ({
    name: 'swimmer_deleted',
    properties:
      swimmerCount !== undefined ? { source, swimmer_count: swimmerCount } : { source },
  }),
  SwimmerPromoted: (promotedCount: number, newSwimmerCount: number): TrackedEvent => ({
    name: 'swimmer_promoted',
    properties: { promoted_count: promotedCount, new_swimmer_count: newSwimmerCount },
  }),
  SessionCreated: (templateCount: number): TrackedEvent => ({
    name: 'session_created',
    properties: { template_count: templateCount },
  }),
  SessionImported: (drillCount: number, category: string): TrackedEvent => ({
    name: 'session_imported',
    properties: { drill_count: drillCount, category },
  }),
  SessionUpdated: (): TrackedEvent => ({
    name: 'session_updated',
  }),
  SessionDeleted: (templateCount: number): TrackedEvent => ({
    name: 'session_deleted',
    properties: { template_count: templateCount },
  }),
  StartDrill: (sessionName: string, stats?: StartDrillStats): TrackedEvent => ({
    name: 'start_drill',
    properties: {
      session_name: sessionName,
      ...(stats ? { drill_count: stats.drillCount, total_distance: stats.totalDistance } : {}),
    },
  }),
  QuickTimeStarted: (virtualSwimmerCount: number): TrackedEvent => ({
    name: 'quick_time_started',
    properties: { virtual_swimmer_count: virtualSwimmerCount },
  }),
  SessionCompleted: (stats: SessionCompletionStats): TrackedEvent => ({
    name: 'session_completed',
    properties: {
      swimmer_count: stats.swimmerCount,
      lap_count: stats.lapCount,
      drill_count: stats.drillCount,
      total_distance: stats.totalDistance,
      duration_ms: stats.durationMs,
      is_quick_start: stats.isQuickStart,
    },
  }),
  SessionDiscarded: (): TrackedEvent => ({
    name: 'session_discarded',
  }),
  SessionReset: (clearSwimmers: boolean): TrackedEvent => ({
    name: 'session_reset',
    properties: { clear_swimmers: clearSwimmers },
  }),
  DrillCreated: (source: DrillSource, stroke: Stroke | '', distance: number): TrackedEvent => ({
    name: 'drill_created',
    properties: { source, stroke, distance },
  }),
  DrillUpdated: (source: DrillSource): TrackedEvent => ({
    name: 'drill_updated',
    properties: { source },
  }),
  DrillDeleted: (source: DrillSource): TrackedEvent => ({
    name: 'drill_deleted',
    properties: { source },
  }),
  DrillAddedToSession: (
    source: DrillAddedSource,
    stroke: Stroke,
    distance: number
  ): TrackedEvent => ({
    name: 'drill_added_to_session',
    properties: { source, stroke, distance },
  }),
  DrillCompleted: (
    lane: number,
    swimmerCount: number,
    distance: number,
    stroke: RunDrillStroke
  ): TrackedEvent => ({
    name: 'drill_completed',
    properties: { lane, swimmer_count: swimmerCount, distance, stroke },
  }),
  SwimmerStarted: (lane: number, swimmerCount: number): TrackedEvent => ({
    name: 'swimmer_started',
    properties: { lane, swimmer_count: swimmerCount },
  }),
  SwimmerCompleted: (lane: number, swimmerCount: number): TrackedEvent => ({
    name: 'swimmer_completed',
    properties: { lane, swimmer_count: swimmerCount },
  }),
  LapRecorded: (lane: number, swimmerCount: number): TrackedEvent => ({
    name: 'lap_recorded',
    properties: { lane, swimmer_count: swimmerCount },
  }),
  // Fires once per sync failure, on the transition into the error phase (not on
  // every retry) so a persistently failing device cannot flood the queue. The
  // table/row identity is deliberately absent: it churns as tables are added and
  // a row UUID identifies nothing in aggregate. Per-collision events carry those
  // separately when that detail is needed.
  SyncError: (stats: {
    kind: string
    message: string
    phase: string
    conflictCount: number
    pendingCount: number
  }): TrackedEvent => ({
    name: 'sync_error',
    properties: {
      kind: stats.kind,
      message: stats.message,
      phase: stats.phase,
      conflict_count: stats.conflictCount,
      pending_count: stats.pendingCount,
    },
  }),
  AppSettings: (
    action:
      | 'sign_in'
      | 'sign_out'
      | 'sync'
      | 'clear_data'
      | 'set_equipment'
      | 'set_pool_length'
      | 'set_team_names'
      | 'set_coach_name'
      | 'backup_exported'
      | 'backup_imported'
      | 'cleanup_run'
      | 'reset_settings'
      | 'request_persist'
      | 'set_data_retention'
      | 'toggle_notifications',
    extra?: Record<string, unknown>
  ): TrackedEvent => ({
    name: 'app_settings',
    properties: { action, ...(extra ?? {}) },
  }),
}

export { analytics, isNewSession } from './analyticsService'
import type { RunDrillStroke, Stroke } from '../types/swimming'
