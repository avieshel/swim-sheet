# Analytics Context

Usage analytics: instrumentation, delivery pipeline, event catalog, and payload policy.
Source: `UI-Context.md` (Analytics Events section) and `client/src/services/
analyticsEvents.ts` / `analyticsService.ts`.

## Instrumentation
Defined in one place: `client/src/services/analyticsEvents.ts` — typed `Events.*`
factories plus the `analytics` facade. Call sites use `analytics.track(Events.ViewSwimmers(count))`;
the old `(string, properties)` signature no longer compiles, so event names and payloads
cannot drift from the registry (`analyticsEventsRegistry.ts` was a conflicting draft and
has been deleted).

## Delivery pipeline
Events queue in localStorage (`swimsheet_analytics_queue`, capped at 500 — oldest dropped;
overflow is counted in persisted health stats) and flush in batches of 50 to Supabase
`analytics_events`. Delivery is at-least-once: every event carries a client-generated
`event_id` (uuidv7, unique index via migration `20261004000002`) so a retried batch that
already landed fails with `23505` and is treated as delivered.

Systemic failures keep the queue and retry with exponential backoff (30s base, 120s cap,
4 attempts). HTTP 429 is treated as retryable throttling; when a `Retry-After` header is
readable it is honored (clamped to the 120s cap), otherwise backoff applies. After max
attempts the remaining queue is dropped to the dead-letter with an explicit reason
(`MAX_RETRIES_EXCEEDED`, or `MAX_RETRIES_EXCEEDED:429` for persistent throttling).

Row-level failures (SQLSTATE class 22/23) recursively split the batch to isolate the
poison event, which moves to the dead-letter list (`swimsheet_analytics_dead_letter`, last
20 entries). Bulk drops (4xx batch rejection, max-retries queue drop) are stored as compact
summary entries with `count` and a representative event, avoiding repeated full payload
storage. Flushes run on every `track`, on `online`, and on `pagehide`/`visibilitychange`
via `fetch keepalive` so closing the tab doesn't lose the queue.

Persisted delivery health lives in `swimsheet_analytics_health` (best-effort, separate from
the queue): `queueOverflowDrops`, `deadLetterDrops`, `lastDropAt`, `lastDropReason`,
`lastFlushSuccessAt`, `lastFlushErrorCode`. `window.analytics.getStats()` exposes these
fields plus `queued`, `deadLetterCount`, in-memory `eventsProduced`/`eventsDelivered`/
`eventsDeadLettered`, and `flushInProgress`.

`device_id` is a uuidv7 in `localStorage` under `swimsheet_device_id`; when `localStorage`
throws (blocked storage, some private modes) it degrades to `sessionStorage` so the id
survives a reload within the tab, and only then to a module-scoped uuid for the page's
lifetime. There is deliberately **no shared fallback constant** — a global literal would
silently merge unrelated users' events into one bucket. Note the id is a client-asserted
grouping hint, not an identity: the anon insert policy is `with check (true)`, so
`device_id` is fully attacker-controlled and must never gate access, quotas, or rate
limits. Every event carries `session_id`, timestamps, timezone, and `app_version` (first 7
chars of the build's git commit, `dev` fallback), plus device context: `device_country`
(2-letter code from the same-origin Cloudflare `/cdn-cgi/trace`, localStorage-cached for
7 days, `null` on non-Cloudflare hosts), `device_language` (navigator.language),
`device_os`, `device_type` (`mobile`|`tablet`|`desktop`), `device_screen` (`WxH`),
`device_connection` (Network Information `effectiveType`, `null` if unsupported).

## Diagnostics / operator checks
- Inspect runtime delivery: `window.analytics.getStats()` in the browser console.
- Inspect persisted queue: `localStorage.getItem('swimsheet_analytics_queue')`.
- Inspect dead-letter: `localStorage.getItem('swimsheet_analytics_dead_letter')` (entries may be summaries with `count`).
- Inspect health counters: `localStorage.getItem('swimsheet_analytics_health')`.
- Supabase check: query `analytics_events` by `device_id`/`user_id` for received events; Supabase cannot show client-side drops, so use health/dead-letter for loss diagnosis.
- `HTTP_4XX:*` dead-letter reasons indicate non-retryable payload/schema rejection; `MAX_RETRIES_EXCEEDED` / `MAX_RETRIES_EXCEEDED:429` indicate persistent systemic/throttling failure after bounded retries.

## Payload policy
Counts, enums, and action types only — no swimmer names, lap times, or free-text notes.

## Event catalog

| Event | Payload | Emitted From |
|-------|---------|--------------|
| `app_opened` | — | `App.tsx` when `isNewSession()` (new 30-min session window) |
| `view_swimmers` | `swimmer_count` | SwimmersList mount (after roster loads) |
| `view_swimmer_profile` | — | SwimmerDetail mount |
| `view_sessions` | `template_count`, `completed_run_count` | SessionsList mount |
| `view_session_template` | `session_id`, `session_name`, `drill_count`, `total_distance` | SessionDetail mount |
| `view_drill_bank` | `drill_count` | DrillBank mount |
| `view_dashboard` | `swimmer_count`, `template_count`, `completed_run_count`, `lap_count` | CoachDashboard mount |
| `view_runs_history` | `run_count`, `swimmer_filter` (`all`\|`swimmer`) | RunsHistory mount |
| `swimmer_created` | `source` (`roster`\|`live_session`), `swimmer_count` | SwimmersList form, GroupCard create-new, LaneEditorModal create-new, ActiveRunView temp→roster save |
| `swimmer_updated` | `source` (`roster`\|`profile`), `swimmer_count?` | SwimmersList form, SwimmerDetail form |
| `swimmer_deleted` | `source` (`roster`\|`profile`), `swimmer_count?` | SwimmersList card, SwimmerDetail delete |
| `swimmer_promoted` | `promoted_count`, `new_swimmer_count` | BatchPromotionModal confirm (temp→roster) |
| `session_created` | `template_count` | SessionsList "Create Template" |
| `session_imported` | `drill_count`, `category` | SessionCatalogCard import |
| `session_updated` | — | SessionDetail name/notes save |
| `session_deleted` | `template_count` | SessionsList template delete |
| `start_drill` | `session_name`, `drill_count`, `total_distance` | `useStartLiveSession` (template → live run) |
| `live_session_opened` | `roster_count` (org roster), `assigned_swimmer_count` (from live `groups`) | `useStartLiveSession` (run opened from template; detects empty-deck dead-end) |
| `quick_time_started` | `virtual_swimmer_count` | LiveDeck quick-time start |
| `session_completed` | `swimmer_count`, `lap_count`, `drill_count`, `total_distance`, `duration_ms`, `is_quick_start` | ActiveRunView finalize (run saved) |
| `session_discarded` | — | ActiveRunView empty-session discard |
| `session_reset` | `clear_swimmers` | ActiveRunView reset-session confirm |
| `drill_created` | `source` (`library`\|`session`), `stroke`, `distance` | DrillBank editor, SessionDetail rich editor |
| `drill_updated` | `source` (`library`\|`session`) | DrillBank editor, SessionDetail rich editor |
| `drill_deleted` | `source` (`library`\|`session`) | DrillBank, SessionDetail (list + editor) |
| `drill_added_to_session` | `source` (`drill_bank`\|`session_detail`), `stroke`, `distance` | Library → session copy |
| `drill_completed` | `lane`, `swimmer_count`, `distance`, `stroke` | TimingService.completeDrill (timed drill saved per group, manual or auto) |
| `swimmer_started` | `lane`, `swimmer_count` | GroupCard start tap (individual or lane Go; only not-yet-started swimmers counted) |
| `swimmer_completed` | `lane`, `swimmer_count` | GroupCard finish tap / lane stop |
| `lap_recorded` | `lane`, `swimmer_count` | GroupCard lap tap (individual or group lap) |
| `run_swimmer_added` | `lane`, `swimmer_count` (from live `groups`) | GroupCard add-to-lane (roster pick / create-new) |
| `signed_in` | `method` (`google`\|`email`\|`test`\|`apple`) | AccountSection sign-in success |
| `signed_out` | — | AccountSection sign-out success |
| `app_backgrounded` | `foreground_ms` | `App.tsx` document `visibilitychange` → hidden |
| `app_foregrounded` | `last_background_ms \| null` | `App.tsx` document `visibilitychange` → visible |
| `search_performed` | `scope` (`swimmers`\|`sessions`\|`drills`\|`runs`), `result_count` | SwimmersList, SessionsList (templates/recent), DrillBank, RunsHistory; debounced, non-empty filters only |
| `session_package_shared` | `drill_count`, `source` (`template`\|`run`) | SessionsList template export |
| `session_package_imported` | `drill_count`, `source` (`share_link`\|`file`), `shared_by?` | SessionPackageImportModal successful import |
| `share_failed` | `error_kind` | SessionsList template export failure |
| `package_import_failed` | `error_kind`, `source` (`share_link`\|`file`) | SessionPackageImportModal import failure |
| `backup_failed` | `error_kind` (`export`\|`import`) | Settings backup export/import failure |
| `ai_draft_requested` | `source` (`harness`\|`direct`) | `api/sessionDraft.ts` before harness request |
| `ai_draft_generated` | `drill_count`, `total_distance`, `source` (`harness`\|`direct`) | `api/sessionDraft.ts` on actionable draft result |
| `ai_draft_accepted` | `drill_count` | AiSessionDraft save/apply success |
| `ai_draft_rejected` | — | AiSessionDraft discard |
| `ai_draft_failed` | `error_kind` | `api/sessionDraft.ts` on non-draft/failure outcome |
| `session_paused` | — | LiveSessionHeader pause toggle |
| `session_resumed` | — | LiveSessionHeader resume toggle (elapsed > 0) |
| `view_exited` | `screen` (`swimmers`\|`swimmer_profile`\|`sessions`\|`session_template`\|`drill_bank`\|`dashboard`\|`runs_history`), `dwell_ms` | Page unmount/cleanup for tracked screens |
| `app_settings` | `action` (13 closed-set values), plus action-specific extras | Settings page + AccountSection |

Notes:
- `signed_in`/`signed_out` replaced the previous `app_settings` `sign_in`/`sign_out` actions.
- `Events.SessionOpenedViaShare` exists in the registry but is not wired because there is no share-link deep-link entry point yet.
- `Events.AccountCreated` and `Events.TimingModeSelected` were not added: the app has no distinct sign-up flow or manual/automatic timing-mode selection control.

Future upgrade candidates (not yet implemented): swimmers-with-session counts over
7/30/60-day windows, timing-mode breakdowns, per-swimmer activity, owner usage rollup view.

## Related
- Design system: `docs/context/UI-Design-System-Context.md`
- Live deck UI: `docs/context/UI-Live-Deck-Context.md`
- Screen specs: `docs/context/UI-Context.md`