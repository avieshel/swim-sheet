import drillCatalogJson from './drills.json'
import sessionsCatalogJson from './sessions.json'
import { DRILL_HEBREW } from '../../../shared/drillLocalization'
import type { Stroke } from '../types/swimming'

type CatalogFocus = 'technique' | 'fitness' | 'none'

interface CatalogDrill {
  slug: string
  name: string
  heName?: string
  popularity: number
  stroke: Stroke
  distance: number
  focus: CatalogFocus
  labels: string[]
  description: string
  parentSlug?: string
}

interface CatalogDrillItem {
  distance: number
  stroke: Stroke
  repeatCount: number
  intensity?: string
  interval?: string
  equipment?: string[]
}

interface CatalogSessionDrill {
  name: string
  order: number
  stroke: Stroke
  distance: number
  items: CatalogDrillItem[]
  repeatCount: number
  focus: CatalogFocus
  labels: string[]
  description: string
}

interface CatalogSession {
  version: number
  name: string
  notes: string
  drills: CatalogSessionDrill[]
}

type CatalogDrillJson = Omit<CatalogDrill, 'heName'> & { heName?: string }

export const drillCatalog: CatalogDrill[] = (drillCatalogJson as CatalogDrillJson[]).map((drill) => {
  const heName = DRILL_HEBREW[drill.slug]?.heName ?? drill.heName
  return heName ? { ...drill, heName } : { ...drill }
})

export const sessionsCatalog = sessionsCatalogJson as CatalogSession[]
