import drillCatalogJson from './drills.json'
import sessionsCatalogJson from './sessions.json'
import type { Stroke } from '../types/swimming'

type CatalogFocus = 'technique' | 'fitness' | 'none'

interface CatalogDrill {
  name: string
  stroke: Stroke
  distance: number
  focus: CatalogFocus
  labels: string[]
  description: string
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
  timingMode: 'individual' | 'continuous'
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

export const drillCatalog = drillCatalogJson as CatalogDrill[]
export const sessionsCatalog = sessionsCatalogJson as CatalogSession[]
