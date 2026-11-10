import { useSyncExternalStore } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/schema'
import type { SessionRun } from '../db/schema'

let cached: SessionRun | null = null
const listeners = new Set<() => void>()
let subscription: { unsubscribe: () => void } | null = null

function notify(): void {
  for (const listener of listeners) listener()
}

function getSnapshot(): SessionRun | null {
  return cached
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  start()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }
}

function start(): void {
  if (subscription) return
  subscription = liveQuery(async (): Promise<SessionRun | null> => {
    const run = await db.sessionRuns.where('status').equals('active').first()
    return run ?? null
  }).subscribe({
    next: (run) => {
      const next = run ?? null
      if (next?.id !== cached?.id) {
        cached = next
        notify()
      }
    },
    error: () => {},
  })
}

function stop(): void {
  if (!subscription) return
  subscription.unsubscribe()
  subscription = null
  cached = null
  notify()
}

function subscribeDisabled(): () => void {
  return () => {}
}

function getDisabledSnapshot(): null {
  return null
}

export function useActiveRun(enabled = true): SessionRun | null {
  return useSyncExternalStore(
    enabled ? subscribe : subscribeDisabled,
    enabled ? getSnapshot : getDisabledSnapshot,
  )
}
