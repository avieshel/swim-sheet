// Hebrew → slug matching index for the AI session harness.
//
// The product owner maintains the source data in shared/drillLocalization.ts.
// This module normalizes those terms and builds the runtime lookup index.
// Entries whose slug is absent from the request's availableDrills are ignored
// at match time, so stale entries are harmless.

import { DRILL_HEBREW } from '../shared/drillLocalization.ts'

export function normalizeHe(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[֑-ֽֿ]/g, '')
    .replace(/[-_/־\s]+/g, ' ')
    .trim()
    .toLowerCase()
}

export interface DrillMatchEntry {
  slug: string
  hint?: string
}

function buildDrillMatchIndex(): Record<string, DrillMatchEntry> {
  const index: Record<string, DrillMatchEntry> = {}
  for (const [slug, loc] of Object.entries(DRILL_HEBREW)) {
    const terms = [loc.heName, ...(loc.aliases ?? [])]
    for (const term of terms) {
      const key = normalizeHe(term)
      if (!key) continue
      index[key] = loc.hint ? { slug, hint: loc.hint } : { slug }
    }
  }
  return index
}

export const drillMatchIndex: Record<string, DrillMatchEntry> = buildDrillMatchIndex()
