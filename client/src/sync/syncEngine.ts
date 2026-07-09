import { db } from '../db/schema'

export interface SyncStatus {
  lastSyncAt: string | null
}

function toCamelCase(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camelKey] = value
  }
  return result
}

function toSnakeCase(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    const snakeKey = key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
    result[snakeKey] = value
  }
  return result
}

export function getSyncStatus(): SyncStatus {
  const raw = localStorage.getItem('swimsheet_sync_key')
  const lastSyncAt = raw ? JSON.parse(raw).lastSyncAt : null
  return { lastSyncAt }
}

async function pushCollection<T extends { id: string | number }>(
  baseUrl: string,
  endpoint: string,
  items: T[]
): Promise<void> {
  for (const item of items) {
    const body = toSnakeCase(item as unknown as Record<string, unknown>)
    delete body.id
    await fetch(`${baseUrl}/api/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
}

export async function pushChanges(baseUrl: string): Promise<void> {
  const swimmers = await db.swimmers.toArray()
  const sessions = await db.sessions.toArray()
  const laps = await db.laps.toArray()
  await pushCollection(baseUrl, 'swimmers', swimmers)
  await pushCollection(baseUrl, 'sessions', sessions)
  await pushCollection(baseUrl, 'laps', laps)
  localStorage.setItem('swimsheet_sync_key', JSON.stringify({ lastSyncAt: new Date().toISOString() }))
}

async function fetchAndMerge<T>(
  baseUrl: string,
  endpoint: string,
  table: { put(item: T): Promise<unknown> }
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/v1/${endpoint}`)
  if (!res.ok) return
  const remoteItems = await res.json()
  for (const item of remoteItems) {
    const converted = toCamelCase(item) as unknown as T
    await table.put(converted)
  }
}

export async function pullChanges(baseUrl: string): Promise<void> {
  await fetchAndMerge(baseUrl, 'swimmers', db.swimmers)
  await fetchAndMerge(baseUrl, 'sessions', db.sessions)
  await fetchAndMerge(baseUrl, 'laps', db.laps)
  localStorage.setItem('swimsheet_sync_key', JSON.stringify({ lastSyncAt: new Date().toISOString() }))
}

export async function syncAll(baseUrl: string): Promise<void> {
  await pushChanges(baseUrl)
  await pullChanges(baseUrl)
}
