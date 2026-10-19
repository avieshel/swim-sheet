# AI-Analytics Trace — Design

**Date:** 2026-10-19
**Status:** Approved (approach A: non-blocking, in-process middleware module)

## Goal

Give the app owner visibility into every AI session-draft request — what prompt/input
was sent, the raw model output, and the error summary (especially timeouts) — without
coupling that observability to the request path. The AI process stays backend-only on
Supabase; nothing is stored on the device (no Dexie).

## Non-goals

- No in-app debug panel (tracked separately).
- No device-side AI activity log.
- No changes to the model prompt or the draft contract semantics.
- No change to the streaming vs. non-streaming behavior of the harness.

## Architecture

A self-contained `analytics/` module inside the Edge Function, injected as a dependency
so it is testable with a fake and never holds back the main logic. The handler emits one
fully-formed trace record at the end of every request branch; the module persists it in
the background via `EdgeRuntime.waitUntil`, swallowing any write error. This satisfies the
"own module, own tables, main process emits events, analytics never blocks" constraint.

```
handler (main logic)
   │  builds AiTraceRecord
   └─> deps.recordTrace(record)   // fire-and-forget
          └─> analytics/emitter  // schedules background write
                 └─> RPC ai_analytics_trace_insert  (SECURITY DEFINER)
                        └─> ai_private.ai_analytics_trace
```

## Data model (new migration, `ai_private` schema)

Mirrors the existing `ai_private.ai_request_log` pattern: a private schema, a table, and a
`SECURITY DEFINER` RPC executable only by `service_role`. The app owner queries
`ai_private.ai_analytics_trace` directly via SQL / the Supabase dashboard.

`ai_private.ai_analytics_trace` columns:

| column | type | notes |
|--------|------|-------|
| id | bigint identity PK | |
| created_at | timestamptz default now() | |
| user_id | uuid | from auth |
| session_id | uuid (nullable) | correlation key with the app's "regular" analytics (`analytics_events.session_id`) |
| trace_id | uuid (nullable) | per-request correlation id for AI-analytics insights |
| model | text | provider model used |
| system_prompt | text | assembled system prompt (no swimmer data by design) |
| user_content | text | assembled user content (sanitized prompt + context + seed) |
| raw_content | text (nullable) | raw model output; null on timeout/invalid |
| provider_status | int (nullable) | upstream HTTP status |
| finish_reason | text (nullable) | model finish reason |
| parsed_outcome | text (nullable) | `draft` / `not_actionable` / null |
| error_kind | text (nullable) | `timeout` / `rate_limited` / `unavailable` / `status` / `network` / `shape` / `invalid` / `rate_limit_unavailable` / `none` |
| error_message | text (nullable) | provider/handler error detail |
| elapsed_ms | int | wall time of the request |
| streamed | boolean | whether the SSE path was used |
| started_at | timestamptz | request start |
| provider_called_at | timestamptz (nullable) | just before the provider call |
| completed_at | timestamptz | request completion |

Indexes: `(user_id, created_at desc)`, `(session_id)`, `(trace_id)`.

RPC `public.ai_analytics_trace_insert(...)` with one parameter per column (explicit, no
`jsonb` plumbing), `security definer`, `set search_path = ai_private, pg_temp`; revoked
from `public`/`anon`/`authenticated`, granted to `service_role`.

### Privacy note

`raw_content` is the raw model text *before* the client-side privacy guard runs on the
structured result. It could in theory contain a swimmer name the model invented. This is
acceptable because the table is owner-only (`ai_private`, service-role only) and the
coach's prompt is already sanitized of swimmer data before it leaves the device.

## Module design

`analytics/types.ts`
- `AiTraceRecord` — the row shape above (snake_case, matching the RPC).
- `AiTraceSink` — `{ record(record: AiTraceRecord): void }` (fire-and-forget).

`analytics/emitter.ts`
- `createTraceEmitter(deps: { insertTrace(row): Promise<void>; schedule(task): void }): AiTraceSink`
- `record()` builds the insert promise, `.catch(()=>{})` so a write failure never reaches
  the caller, and hands the promise to `schedule` (the real impl passes `EdgeRuntime.waitUntil`).

## Handler integration

- `HandlerDeps` gains `recordTrace: (record: AiTraceRecord) => void`.
- After request validation, the handler builds a `traceBase` (user_id, session_id,
  trace_id, model, system_prompt, user_content, started_at) and a local `emit(extra)` that
  finalizes elapsed_ms/completed_at and calls `recordTrace`.
- `emit` is called on: client rate-limit denied, provider success, invalid-provider-response,
  and every `ProviderError` branch (timeout, rate_limited, unavailable, status, network, shape),
  plus the SSE `done`/`error` frames. Client-aborted streams are not recorded (noise).
- The handler builds `system_prompt`/`user_content` via the existing pure
  `buildSystemPrompt`/`buildUserContent` (no logic duplication).
- For the non-streaming raw model output, `deps.runAgent` returns
  `{ result, rawContent, providerStatus, finishReason }`. To avoid touching `callProvider`'s
  return type (the eval pipeline calls it directly), `callProvider` gains an optional
  `onMeta(meta)` callback it invokes with the raw content / status / finish reason. The
  composition root (`deps.ts`) wires the callback into the richer `runAgent` shape.

## Contract changes (`shared/sessionDraft`)

`SessionDraftRequest` gains two optional correlation fields:

- `analyticsSessionId?: string` — the app's regular-analytics session id.
- `traceId?: string` — a fresh per-request uuid (client-generated via `uuidv7`).

`validateSessionDraftRequest` permits these keys and bounds them (optional, string,
≤ 64 chars, a short token). They are not sent to the provider — only recorded for tracing.

## Client changes

- `analyticsService` exports `getAnalyticsSessionId()` (returns/creates the existing
  `swimsheet_session_id`).
- `api/sessionDraft.ts` adds `analyticsSessionId` (from `getAnalyticsSessionId()`) and
  `traceId` (`uuidv7()`) to the request body for both the streaming and non-streaming paths.

## Security

- Table and RPC in `ai_private`; RPC `SECURITY DEFINER`, only `service_role` may execute.
- Matches the existing `ai_request_log` / `ai_request_record` posture exactly.

## Testing

- `analytics/emitter_test.ts` — `record()` invokes `insertTrace` with the row and schedules
  the write; an `insertTrace` rejection does not throw.
- `harness/handler_test.ts` — add a capturing `recordTrace` fake; assert it is called on
  success and on a timeout, with the expected fields. Update `runAgent` fakes to the new
  `{ result, rawContent, ... }` shape.
- `client/.../validate.test.ts` — optional correlation ids are accepted; junk is rejected.
- `supabase/tests/ai_analytics_trace_check.sql` — mirrors `ai_rate_limit_check.sql`: asserts the table
  exists in `ai_private` and the RPC is executable by `service_role` but not `anon`/`authenticated`.
- `deno task check` + `deno task test` (Edge Function) and `npm run check` (client) must pass.

## Rollout / observability

After deploy, the app owner can inspect AI requests with e.g.:

```sql
select created_at, error_kind, elapsed_ms, parsed_outcome, left(raw_content, 80) as raw
from ai_private.ai_analytics_trace
order by created_at desc
limit 50;
```

The timeout worry is answered directly: rows with `error_kind = 'timeout'` and a
`provider_called_at` but short `elapsed_ms` (~25s) confirm an application-level
`PROVIDER_REQUEST_TIMEOUT_MS` abort, not a Supabase platform timeout.
