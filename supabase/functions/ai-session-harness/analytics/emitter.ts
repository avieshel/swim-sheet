// The AI-analytics emitter: the "middleware" seam the harness writes to.
//
// It is deliberately tiny and side-effect-free on its own. All I/O is injected:
// `insertTrace` performs the actual persistence, and `schedule` decides how the
// write runs (the real deployment uses `EdgeRuntime.waitUntil` so the insert
// finishes after the response is sent, without holding back the request).
//
// A write failure is swallowed: observability must never break the AI path.

import type { AiTraceRecord, AiTraceSink } from './types.ts'

export interface TraceEmitterDeps {
  insertTrace(row: AiTraceRecord): Promise<void>
  // Schedules a background task. Mirrors `EdgeRuntime.waitUntil(promise)`.
  schedule(task: Promise<void>): void
}

export function createTraceEmitter(deps: TraceEmitterDeps): AiTraceSink {
  return {
    record(record: AiTraceRecord): void {
      const task = deps.insertTrace(record).catch(() => {})
      deps.schedule(task)
    },
  }
}
