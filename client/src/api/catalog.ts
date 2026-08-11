import { addSession, addDrill, getAllSessions } from '../db/dao'

type CatalogFocus = 'technique' | 'fitness' | 'none'

export interface CatalogSessionIndex {
  id: string
  name: string
  description: string
  category: string
  drillCount: number
  totalDistance: number
  file: string
}

export interface CatalogIndex {
  version: number
  sessions: CatalogSessionIndex[]
}

interface CatalogDrillItem {
  distance: number
  stroke: string
  repeatCount: number
  intensity?: string
  interval?: string
  equipment?: string[]
}

interface CatalogSessionDrill {
  name: string
  order: number
  stroke: string
  distance: number
  items: CatalogDrillItem[]
  repeatCount: number
  timingMode: 'individual' | 'continuous'
  focus: CatalogFocus
  labels: string[]
  description: string
}

export interface CatalogSessionData {
  version: number
  name: string
  notes: string
  drills: CatalogSessionDrill[]
}

const CATALOG_BASE = '/sessions'

export async function fetchCatalog(): Promise<CatalogIndex> {
  const res = await fetch(`${CATALOG_BASE}/catalog.json`)
  if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.status}`)
  return res.json()
}

export async function fetchSessionFile(file: string): Promise<CatalogSessionData> {
  const res = await fetch(`${CATALOG_BASE}/${file}`)
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`)
  return res.json()
}

export async function importSession(session: CatalogSessionData): Promise<string> {
  const sessionId = await addSession({
    name: session.name,
    notes: session.notes,
  })

  for (const d of session.drills) {
    await addDrill({
      session_id: sessionId,
      name: d.name,
      order: d.order,
      stroke: d.stroke,
      distance: d.distance,
      items: d.items.map(item => ({ id: crypto.randomUUID(), ...item })),
      repeatCount: d.repeatCount,
      timingMode: d.timingMode,
      focus: d.focus,
      labels: d.labels,
      description: d.description,
    })
  }

  return sessionId
}

export async function getImportedSessionNames(): Promise<Set<string>> {
  const sessions = await getAllSessions()
  return new Set(sessions.map(s => s.name))
}
