# Analytics Delivery Robustness & Visibility Plan

> **Status:** Planned — do not implement yet.  
> **Date:** 2026-11-23  
> **Scope:** Improve confidence that client analytics events actually reach Supabase, and make drops/stalls observable.

## Problem

The current analytics pipeline (`client/src/services/analyticsService.ts`) is reasonable for lightweight PWA telemetry, but it has blind spots that make it hard to guarantee full visibility into user behavior.

Observed/current behavior from code review:

- Queue is capped at **500** events in `localStorage` (`MAX_QUEUE = 500`). Overflow keeps only the newest 500 and **silently drops oldest events**; no dead-letter and no persisted signal (`saveQueue`, `:14,168-176`).
- Flush is **event-driven**, not interval-driven: on every `track()`, on `online`, on `pagehide`, and on `visibilitychange:hidden` (`:453,462-475`). No periodic background flush.
- Offline: `flush()` returns early when `navigator.onLine === false` (`:333`). Events still enqueue in localStorage (`:431-456`) and survive reloads, but can be dropped by overflow or storage failures.
- Retryable systemic failures (`5xx`, network, `status===0`) back off with `30s` base, `120s` max, `4` attempts (`:17-19,264-268,320-329,364-377`). After max attempts, the **entire remaining queue** is dropped to dead-letter as `MAX_RETRIES_EXCEEDED` (`:365-370,397-411`).
- Dead-letter keeps only the **last 20** entries (`:15,183`), so drop detail is lossy.
- Non-retryable 4xx responses (not `409/23505`, not SQLSTATE `22/23`) are treated as systemic non-retryable and dropped to dead-letter (`:264-265,352-356`). **This includes HTTP 429**, so Supabase/API throttling can currently become data loss instead of backoff.
- Delivery stats (`eventsProduced/eventsDelivered/eventsDeadLettered`) are **in-memory only** and reset on page reload (`:309-311,422-429`).
- Supabase is the source of truth for events that arrived, but there is **no server-side signal** for client-side drops, queue pressure, or dead-lettered events.

## Goals

- Reduce silent analytics loss.
- Make delivery health inspectable on-device and, optionally, in Supabase.
- Keep the solution small and aligned with the existing localStorage queue design unless evidence shows more is needed.

## Non-goals

- No full redesign to IndexedDB/Worker unless later evidence requires it.
- No new analytics dashboard UI beyond minimal diagnostics/debug hooks needed for confidence.
- No change to analytics payload policy (counts/enums/action types only; no PII/free text expansion).
- No change to event catalog semantics except optional health/diagnostic events if explicitly approved.

## Proposed Work

### Task 1 — Treat 429 as retryable throttling

**Why:** Current code classifies 429 as non-retryable 4xx and drops the batch to dead-letter. Throttling should back off, not discard data.

**Plan:**
- In `insertRows`/flush logic, detect `res.status === 429` as retryable systemic.
- Honor `Retry-After` header when present; fall back to existing exponential backoff.
- Add a bounded max retry/wait policy so a persistent 429 does not loop forever without visibility; if it ultimately gives up, record an explicit reason.
- Add tests in `client/src/services/__tests__/analyticsService.test.ts` for 429 retry, Retry-After handling, and eventual failure behavior.

**Files:** `client/src/services/analyticsService.ts`, `client/src/services/__tests__/analyticsService.test.ts`

### Task 2 — Make queue overflow and drops observable

**Why:** Overflow currently drops oldest events silently. Dead-letter details are capped at 20. In-memory stats reset on reload.

**Plan:**
- Persist lightweight health counters in localStorage (separate key, e.g. `swimsheet_analytics_health`), such as:
  - `queueOverflowDrops`
  - `deadLetterDrops`
  - `lastDropAt`
  - `lastDropReason`
  - `lastFlushSuccessAt`
  - `lastFlushErrorCode`
  - optional cumulative delivered/produced counters if useful
- When `saveQueue` drops due to cap, record an overflow drop signal. Consider also adding a dead-letter entry with `error_code: "QUEUE_OVERFLOW"` where appropriate, but avoid unbounded noise.
- Extend `analytics.getStats()` to include persisted health fields and current queue/dead-letter sizes.
- Keep behavior best-effort; diagnostics must never break user interaction.

**Files:** `client/src/services/analyticsService.ts`, tests

### Task 3 — Improve dead-letter usefulness

**Why:** `MAX_DEAD_LETTER=20` loses detail during large failure events.

**Plan:**
- Evaluate increasing dead-letter retention or storing summarized drop records (count + error code + time window) instead of full per-event bodies for bulk drops.
- Ensure `MAX_RETRIES_EXCEEDED` records enough information to diagnose how many events were lost and when.
- Be mindful of localStorage size; avoid storing large payloads repeatedly.

**Files:** `client/src/services/analyticsService.ts`, tests

### Task 4 — Add optional server-visible health telemetry

**Why:** Supabase can only confirm received events. Client drops are invisible server-side unless reported.

**Plan:**
- Add a compact health event or periodic report, only if approved after Tasks 1-3. Candidate payload: counts/enums only (queue size, dead-letter count, overflow drop count, last error kind bucket).
- Rate-limit aggressively (e.g. once per session/day or only on threshold transitions) to avoid feedback loops and queue pressure.
- Ensure health reporting cannot cause recursive failure amplification; if analytics is unhealthy, drop/skip health report safely.

**Files:** `client/src/services/analyticsEvents.ts`, `client/src/services/analyticsService.ts`, emitting call site, tests, `docs/context/Analytics-Context.md`

### Task 5 — Document diagnostics and operator checks

**Why:** Owners/devs need a simple way to confirm delivery.

**Plan:**
- Update `docs/context/Analytics-Context.md` with queue/cap/retry/drop behavior, `getStats()` fields, localStorage keys, and known limitations.
- Add a short troubleshooting section: how to inspect `window.analytics.getStats()`, queue/dead-letter keys, Supabase query by `device_id`, and how to interpret 429/overflow/max-retries cases.
- If health telemetry is added, document its event name and payload policy.

**Files:** `docs/context/Analytics-Context.md`, possibly this plan doc status update

## Validation / Acceptance Criteria

- `npm run check` passes.
- Unit tests cover: 429 retry/backoff, queue overflow reporting, dead-letter summarization/retention behavior, persisted health stats across reload simulation, and no-regression for existing dedupe/retry/keepalive behavior.
- `window.analytics.getStats()` exposes enough information to answer: “are events queued, delivered, or dropped?”
- Overflow and throttle scenarios no longer fail silently.
- Docs reflect the actual behavior after implementation.

## Risks / Notes

- **localStorage limits:** adding health/dead-letter detail can increase storage pressure; keep records compact.
- **Feedback loops:** health telemetry must be rate-limited and safe when the queue is unhealthy.
- **429 handling:** backing off is better than dropping, but prolonged throttling can still fill the queue; overflow visibility becomes important.
- **At-least-once semantics remain:** retries may resend batches; `event_id` dedupe in Supabase remains the correctness guard.
- **Full visibility is not absolute:** client-side analytics can only be best-effort; goal is to make loss rare and observable.

## Recommended Implementation Order

1. Task 1 — 429 retry/backoff (clear correctness/robustness win).
2. Task 2 — persisted drop/health visibility (highest visibility win).
3. Task 3 — dead-letter usefulness.
4. Task 5 — docs/checks.
5. Task 4 — optional server-visible health telemetry, only if still needed after 1-3.