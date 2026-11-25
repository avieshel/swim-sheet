// Pure matcher: turns a coach prompt into drill-reuse hints drawn from the
// controlled index. Only entries whose slug is actually present in the request's
// availableDrills are emitted, so the model is never pointed at a drill the
// client cannot resolve. Results are sorted most-specific-term first, then by
// the matched drill's popularity, so the most likely hit leads.

import { drillMatchIndex, normalizeHe } from './drillMatchIndex.ts'

export interface DrillHint {
  slug: string
  term: string
  name: string
  heName?: string
  hint?: string
}

export function matchDrillHints(
  prompt: string,
  availableDrills: { slug: string; name: string; heName?: string; popularity: number }[],
): DrillHint[] {
  const normalizedPrompt = normalizeHe(prompt)
  const bySlug = new Map(availableDrills.map((drill) => [drill.slug, drill]))

  const hits: Array<{ hint: DrillHint; termLength: number; popularity: number }> = []
  for (const [key, entry] of Object.entries(drillMatchIndex)) {
    if (!normalizedPrompt.includes(key)) continue
    const drill = bySlug.get(entry.slug)
    if (!drill) continue
    hits.push({
      hint: { slug: entry.slug, term: key, name: drill.name, heName: drill.heName, hint: entry.hint },
      termLength: key.length,
      popularity: drill.popularity,
    })
  }

  hits.sort((a, b) => b.termLength - a.termLength || b.popularity - a.popularity)
  return hits.map((hit) => hit.hint)
}
