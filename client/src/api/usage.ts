import { supabase } from './supabase'

export const ANALYTICS_ROLLUP_MAX_WINDOW_DAYS = 30
const ANALYTICS_ROLLUP_MIN_WINDOW_DAYS = 1

export interface AnalyticsRollupRow {
  event_name: string
  day: string
  event_count: number
}

export async function getAnalyticsRollup(windowDays: number): Promise<AnalyticsRollupRow[]> {
  const clampedWindowDays = Math.min(
    ANALYTICS_ROLLUP_MAX_WINDOW_DAYS,
    Math.max(ANALYTICS_ROLLUP_MIN_WINDOW_DAYS, Math.round(windowDays)),
  )
  const { data, error } = await supabase.rpc('analytics_event_rollup', { window_days: clampedWindowDays })
  if (error) throw error
  return (data ?? []) as AnalyticsRollupRow[]
}
