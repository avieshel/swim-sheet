# Coach Assist Session Workspace Design

## Status

Approved conversational design; implementation has not started. This spec covers
owner-assisted session-template creation, editing, AI generation, and `.swimsheet`
import into a selected coach's personal Supabase organization.

## Intent and success criteria

The app owner opens `/admin/coach-assist`, selects a coach, and then uses the
regular SwimSheet session experience to work on that coach's data. Session reads
and writes in Coach Assist mode go directly to the selected coach's Supabase
tenant through the existing owner-only `admin-coach-assist` Edge Function. They
must not read from or write to the owner's Dexie database.

The first supported work area is session templates: create a session, edit its
metadata and embedded drills, generate a session with AI, and import a validated
`.swimsheet` JSON package. After a successful write, the coach's ordinary sync
pull delivers the new or updated rows to their device.

## Scope

### In scope

- Reuse the regular session list, session detail/editor, and AI draft screens.
- Create and edit session templates and their embedded drills for the selected
  coach.
- Generate an AI draft, review/edit it in the existing draft UI, and save it to
  the selected coach's tenant.
- Import one `.swimsheet` package as a new session copy in the selected coach's
  tenant, with preview, validation, and existing name-conflict behavior.
- Preserve owner-only authorization, server-side target-organization resolution,
  and tenant isolation.
- Make a session plus its drills a single all-or-nothing target write.

### Out of scope

- Copying sessions directly from the owner's session list or cloud account. The
  import source in this scope is an uploaded `.swimsheet` JSON file.
- Live runs, completed history, run editing, or live timing in Coach Assist.
- Deleting session templates in Coach Assist. The current delete-safety check
  depends on owner-local run data, and deletion is not needed for the first
  session-authoring workflow.
- Changes to swimmer management, the standalone drill bank, settings, or other
  non-session features. Existing navigation and behavior outside this session
  work are not redesigned here.
- Cloud synchronization of app settings. AI generation continues to use the
  selected coach's available session/swimmer context and the current device's
  local authoring preferences where the app has no cloud-backed setting.
- Session sharing, ongoing links, or copying run/swimmer history.

## Existing architecture to reuse

- `CoachAssistContext` selects a target coach and configures the admin DAO scope.
- `Layout`, `SessionsList`, `SessionDetail`, and `/sessions/ai` provide the
  existing app shell and session UI. The Live tab remains suppressed in Coach
  Assist because live-run persistence is not target-scoped.
- `client/src/db/dao.ts` is the existing DAO facade. In normal mode it uses
  Dexie; in Coach Assist mode it delegates to `client/src/db/adminDao.ts`.
- Existing session pages and the shared app layout also trigger local-only side
  effects unrelated to authored session rows: starter-template seeding, active-run subscriptions,
  run-history reads, local library seeding, and run-aware session deletion. These
  must be disabled in the Coach Assist session flow; the editor may read the
  selected coach's library through the scoped DAO for its similarity warning.
- `adminDao.ts` and `adminCoachService.ts` already route owner-assisted reads and
  writes through `admin-coach-assist`, whose Edge Function holds the service-role
  client and resolves the selected coach's organization server-side.
- `AiSessionDraft`, `shared/sessionDraft/`, and the existing session-draft
  mapping/validation remain the AI proposal flow.
- `SessionPackageImportModal`, `sessionPackageService`, and
  `shared/sessionPackage/` remain the package import UI, mapping, and canonical
  validation/config contract.

No parallel admin session editor, AI draft page, package schema, or validator is
introduced. Add only the missing target-scoped persistence seam and integration
tests needed to make the existing modules safe to reuse.

## User flow

1. The owner opens `/admin/coach-assist` and selects a coach.
2. The app enters the normal session experience with a visible Coach Assist
   indicator identifying the selected coach and a clear exit/switch path.
3. From Sessions, the owner can create a blank template, open and edit a
   template's metadata and embedded drills, open **Create with AI**, or import a
   `.swimsheet` package.
4. AI generation stages a proposal as it does today. Nothing is persisted until
   the owner saves it.
5. Package import validates and previews the file before confirmation. A
   name-conflict prompt offers the existing copy/rename choice; it never
   overwrites a target session.
6. Writes go to the selected coach's Supabase organization. Exiting Coach Assist
   restores the owner's normal Dexie-backed experience.

In Coach Assist mode, the shared layout and session list/detail do not seed
starter sessions or library drills in the owner's Dexie, subscribe to owner-local
active runs, or fetch owner-local run history. Session-template deletion is
hidden in this scope rather than consulting or mutating owner-local run data.
The session-detail similarity mirror, when loaded, comes from the selected
coach's scoped library read.

## Data flow and trust boundaries

### Session create/edit

- Session pages continue to call the existing API and DAO facade.
- With Coach Assist configured, DAO reads use the target-scoped admin read path;
  DAO writes use the owner-only Edge Function. There is no Dexie fallback while
  a coach scope is active: missing scope or remote failure must fail closed.
- The Edge Function authenticates the JWT, checks the owner allowlist, resolves
  the target's single personal organization on the server, and stamps
  `organization_id` and `created_by`. Client-supplied ownership fields are never
  trusted.
- The selected coach's ordinary sync pull reads the inserted/updated rows. Other
  tenants remain isolated by organization scope and RLS.

### AI generation

- Reuse the existing AI page, request contract, sanitizer, and draft editor.
- Reads used for target-specific session/swimmer context pass through the scoped
  DAO, so they describe the selected coach rather than the owner's Dexie data.
- AI generation remains authenticated as the app owner. The AI harness does not
  receive a service-role credential or write to a tenant.
- Saving the reviewed draft uses the same target-scoped bulk session-and-drills
  persistence path as other session creation. It must not save locally and wait
  for the owner's sync process.
- Where a generation preference exists only in local app settings, it remains
  the current device's preference; this feature does not add cloud settings.

### Package import

- Reuse the existing `.swimsheet` v1 file reader, package validator/config,
  preview, mapping, generated IDs, and name-conflict UI.
- The client validates before preview; the Edge Function validates the package
  again as untrusted input before any write.
- Import creates a fresh target-owned session and fresh drill/item IDs. It does
  not copy owner IDs, tenant fields, library provenance, swimmers, runs, or
  history.
- A failed import creates no session or drills. A name conflict never silently
  overwrites a target record.

### Atomic persistence seam

The current normal-mode Dexie path can write a session and its drills inside a
Dexie transaction. The current Coach Assist generic path performs separate
remote row writes, so it cannot provide the same rollback guarantee. Add one
target-scoped bulk operation to the existing admin DAO/service/Edge Function
boundary and route both AI saves and package imports through it. The operation
must persist the session and all drills transactionally (for example, through a
service-role-only Postgres function invoked by the owner-gated Edge Function).
The database function receives only the server-resolved target scope and
allowlisted authored fields; it does not expose a client-callable cross-tenant
write path. Session edits continue to use the existing scoped row update path.

## Validation and error behavior

- Keep package and AI draft validation in their existing shared contracts; do
  not duplicate allowlists or limits in the client and Edge Function.
- Validate the bulk-write shape and authored fields at the Edge Function
  boundary, even for owner-authenticated requests.
- Return a recoverable conflict outcome for package name collisions and a clear
  failure for unauthorized, missing-target, invalid-payload, or remote-write
  errors. Never report success for a partial write.
- Failure to load target data must not silently render the owner's local data as
  a substitute.

## Verification

- DAO tests prove Coach Assist reads and writes call the admin service and do
  not touch Dexie; normal-mode DAO behavior remains unchanged.
- Edge Function unit tests cover the owner gate, missing/ambiguous target
  organization, reserved ownership fields, invalid session/drill payloads,
  successful bulk creation, duplicate-name conflict, and rollback on a drill
  insertion failure.
- Shared/package tests continue to prove strict validation, size limits,
  unknown-field rejection, fresh IDs, and rich authored-field preservation.
- AI flow tests prove target context is used and the reviewed draft is saved to
  the selected coach rather than the owner's tenant.
- UI tests prove the session flows are reachable from Coach Assist, show the
  selected-coach indicator, support preview/conflict/cancel/success for import,
  and surface remote failures without claiming a save.
- End-to-end isolation verification writes through Coach Assist to Coach A,
  proves Coach A's normal sync pull receives the complete session, and proves
  Coach B's pull and the owner's local Dexie do not receive it.
- Run the relevant client checks, Edge Function tests/type checks, and the
  existing Supabase isolation verification before declaring completion.

## Documentation impact

On implementation, update `docs/context/UI-Context.md` for the supported Coach
Assist session experience and `docs/context/DB-Sync-Context.md` for the bulk
write and delivery guarantees. Update `docs/context/App-Context.md` only if the
shared DAO/Edge Function boundary or app architecture materially changes.
