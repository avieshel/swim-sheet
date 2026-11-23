import { supabase } from './supabase'

export interface AnalyticsRollupRow {
  event_name: string
  day: string
  event_count: number
}

export async function getAnalyticsRollup(windowDays: number): Promise<AnalyticsRollupRow[]> {
  const { data, error } = await supabase.rpc('analytics_event_rollup', { window_days: windowDays })
  if (error) throw error
  return (data ?? []) as AnalyticsRollupRow[]
}
