// Controlled, easily-editable Hebrew → slug matching index for the harness.
//
// The product owner maintains this map. Each KEY is the normalized form of a
// Hebrew coach shorthand (see normalizeHe); each VALUE names the known drill
// slug the model should reuse via sourceSlug. Entries whose slug is absent from
// the request's availableDrills are ignored at match time, so stale entries are
// harmless.

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

export const drillMatchIndex: Record<string, DrillMatchEntry> = {
  [normalizeHe('יד-יד')]: { slug: 'single-arm-pull' },
  [normalizeHe('יד אחת')]: { slug: 'single-arm-pull' },
  [normalizeHe('יד-יד יד מוארכת')]: { slug: 'single-arm-pull-arm-extended', hint: 'other arm extended forward' },
  [normalizeHe('גרירת אצבעות')]: { slug: 'fingertip-drag' },
  [normalizeHe('שריטת מים')]: { slug: 'sculling' },
  [normalizeHe('אגרופים')]: { slug: 'fist-drill' },
  [normalizeHe('בעיטות')]: { slug: 'kick' },
  [normalizeHe('זחילה')]: { slug: 'crawl' },
  [normalizeHe('נשימה')]: { slug: 'breathing' },
}
