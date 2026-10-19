// The owner-only AI-analytics trace record and sink contract.
//
// This is the single shape the handler emits and the emitter persists. Column
// names are snake_case to match the `ai_private.ai_analytics_trace` table and the
// `ai_analytics_trace_insert` RPC directly, so there is no per-call remapping.

export interface AiTraceRecord {
  user_id: string
  session_id: string | null
  trace_id: string | null
  model: string
  system_prompt: string
  user_content: string
  raw_content: string | null
  provider_status: number | null
  finish_reason: string | null
  parsed_outcome: string | null
  error_kind: string | null
  error_message: string | null
  attempt_count: number
  elapsed_ms: number
  streamed: boolean
  started_at: string
  provider_called_at: string | null
  completed_at: string
}

// Fire-and-forget sink. Implementations must never throw into the caller and
// must not block the request path.
export interface AiTraceSink {
  record(record: AiTraceRecord): void
}
