import { useSyncExternalStore } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/schema'
import type { SessionRun } from '../db/schema'

let cached: SessionRun | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function getSnapshot(): SessionRun | null {
  return cached
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let started = false
function start(): void {
  if (started) return
  started = true
  void liveQuery(async (): Promise<SessionRun | null> => {
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

export function useActiveRun(): SessionRun | null {
  return useSyncExternalStore(subscribe, getSnapshot)
}
