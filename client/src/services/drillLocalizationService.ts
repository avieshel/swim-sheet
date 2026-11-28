import { supabase } from '../api/supabase'
import { getDrillHeNameOverride } from './drillLocalizationOverrides'

export interface DrillHebrewLocalization {
  heName: string
  aliases?: string[]
  hint?: string
}

type LocalizationMap = Record<string, DrillHebrewLocalization>

let cache: LocalizationMap | null = null

// The canonical drill Hebrew map lives in the edge function
// (ai-session-harness/shared/drillLocalization.ts) and is edited there. The PWA
// fetches it at runtime so the owner can update names with only a function
// redeploy — never a client app release.
export async function fetchDrillLocalization(force = false): Promise<LocalizationMap> {
  if (cache && !force) return cache
  try {
    const { data, error } = await supabase.functions.invoke('ai-session-harness', {
      body: { intent: 'drill-localization' },
    })
    const map = (data as { localization?: LocalizationMap } | null)?.localization
    if (!error && map && typeof map === 'object') {
      cache = map
    }
  } catch {
    // Keep any previously cached map; on failure we fall back to the persisted or
    // model-supplied name passed by the caller.
  }
  return cache ?? {}
}

// Display Hebrew name: per-device coach override > edge-function map > bundled
// catalog heName fallback.
export function resolveDrillDisplayName(slug: string | undefined, fallback?: string): string | undefined {
  if (!slug) return fallback
  const override = getDrillHeNameOverride(slug)
  if (override) return override
  const fromServer = cache?.[slug]?.heName
  if (fromServer) return fromServer
  return fallback
}
