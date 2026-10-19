// The AI-analytics emitter: fire-and-forget, failure-isolated, injectable.

import { assertEquals } from 'jsr:@std/assert@1'
import { createTraceEmitter } from './emitter.ts'
import type { AiTraceRecord } from './types.ts'

const record: AiTraceRecord = {
  user_id: 'u1',
  session_id: null,
  trace_id: null,
  model: 'm',
  system_prompt: 'sys',
  user_content: 'user',
  raw_content: null,
  provider_status: null,
  finish_reason: null,
  parsed_outcome: null,
  error_kind: 'none',
  error_message: null,
  elapsed_ms: 1,
  streamed: false,
  started_at: new Date().toISOString(),
  provider_called_at: null,
  completed_at: new Date().toISOString(),
}

Deno.test('emitter schedules the insert and never throws synchronously', async () => {
  let inserted: AiTraceRecord | null = null
  let scheduled: Promise<void> | null = null
  const emitter = createTraceEmitter({
    insertTrace: (row) => {
      inserted = row
      return Promise.resolve()
    },
    schedule: (task) => {
      scheduled = task
    },
  })
  emitter.record(record)
  assertEquals(inserted, record)
  assertEquals(scheduled !== null, true)
  await scheduled!
})

Deno.test('emitter swallows insert failures', async () => {
  let scheduled: Promise<void> | null = null
  const emitter = createTraceEmitter({
    insertTrace: () => Promise.reject(new Error('boom')),
    schedule: (task) => {
      scheduled = task
    },
  })
  // Must not throw, and the scheduled task must settle without propagating.
  emitter.record(record)
  await scheduled!
})
