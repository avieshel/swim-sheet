# SwimSheet — Supabase & AI Modular Task Cards

This file contains isolated, self-contained task cards for implementing the Supabase backend and AI co-pilot. You can copy-paste individual tasks directly to developer subagents or AI coding tools.

---

## Prerequisites & Manual Actions Required By You

Before starting the tasks below, you must complete these external steps:
1. **Create a Supabase Account:** Go to [supabase.com](https://supabase.com) and create a free account and project.
2. **Install Supabase CLI:** Run `npm install -g supabase` or use `npx supabase`.
3. **Get an LLM API Key:** Obtain an API key from OpenAI (e.g., `gpt-4o-mini`) or Anthropic (e.g., `claude-3-5-haiku`) for the AI Co-Pilot.

⚠️ **Cost & Security Warnings to Keep in Mind:**
* **LLM API Costs:** Every message turn in the AI session builder consumes input and output tokens. Implement rate limits in your Supabase Edge Function to prevent runaway API loops or abuse.
* **Secret Management:** **Never** put your OpenAI/Anthropic API keys in client-side TypeScript code (`client/src/`). Store them exclusively in Supabase Edge Function Secrets (`supabase secrets set OPENAI_API_KEY=...`).
* **Row Level Security (RLS):** Always enable RLS on every Postgres table (`alter table X enable row level security;`) and write explicit policies (`auth.uid() = user_id`). Without RLS, any authenticated user can read or overwrite other coaches' swimmer data.

---

## Task 1: Local CLI Setup & SQL Schema

### Objective
Initialize Supabase locally using Docker, create the core database schema mirroring Dexie tables, and set up Row Level Security (RLS) policies for multi-tenancy and swim schools.

### Instructions for Agent
1. Run `npx supabase init` and `npx supabase start` to boot local Docker containers.
2. Create migration file `supabase/migrations/20260925000000_initial_schema.sql` containing:
   - `swim_schools` table
   - `school_memberships` table with roles (`owner`, `head_coach`, `assistant_coach`)
   - `swimmers`, `sessions`, `drills`, `session_runs`, `run_drills`, `run_swimmers`, `lane_drill_results` referencing `school_id` and `user_id`.
   - `analytics_events` table for user telemetry.
   - `llm_usage` table for tracking token costs.
3. Enable RLS on all tables and write strict access policies.
4. Verify by running `npx supabase db reset`.

---

## Task 2: Client Integration & Settings UI

### Objective
Integrate the `@supabase/supabase-js` client into the React PWA and add a "Cloud & AI Enhancements" section in `Settings.tsx` with a master client-only/cloud toggle.

### Instructions for Agent
1. Install `@supabase/supabase-js`.
2. Create `client/src/api/supabase.ts` exposing a safe singleton client initialized via `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Extend `SettingsData` in `client/src/services/settingsService.ts` and `client/src/db/schema.ts` to include `cloudModeEnabled`, `supabaseUrl`, `supabaseAnonKey`, and `analyticsOptIn`.
4. Update `client/src/pages/Settings.tsx` to add a **Cloud & AI Enhancements** card with:
   - Master toggle: "Enable Cloud & AI Features"
   - Inputs for URL & Anon Key (or automatic env detection)
   - Login / Auth state modal.
5. Ensure that when `cloudModeEnabled` is `false` (default), the app operates 100% locally with zero network calls to Supabase.

---

## Task 3: Offline-First Async Sync Engine

### Objective
Implement an asynchronous background sync engine that pushes local Dexie mutations to Supabase Postgres when online and `cloudModeEnabled` is true, using Last-Write-Wins (LWW).

### Instructions for Agent
1. Create `client/src/sync/supabaseSyncEngine.ts`.
2. Attach Dexie table hooks (`creating`, `updating`, `deleting`) in `client/src/db/schema.ts` to queue pending changes in a local `pending_sync_queue` table.
3. Implement a background sync worker that runs periodically (and on `window.online`) when `cloudModeEnabled` is active:
   - Batches queued changes and upserts them to Supabase tables.
   - Resolves conflicts using `updatedAt` vs `updated_at` (Last-Write-Wins).
4. Add unit tests in `client/src/sync/__tests__/syncEngine.test.ts` mocking network conditions.

---

## Task 4: Product Analytics Telemetry

### Objective
Capture non-identifiable user analytics events in client-side memory/localStorage and batch-sync them to the Supabase `analytics_events` table.

### Instructions for Agent
1. Create `client/src/services/analyticsService.ts`:
   - `track(eventName, properties)` function.
   - Filters out sensitive data (swimmer names, lap times, notes) — records counts, enums, and action types only.
   - Buffers events in-memory and flushes to Supabase (`analytics_events`) every 30s or when buffer reaches 20 events, provided `analyticsOptIn` and `navigator.onLine` are true.
2. Instrument key user actions across pages:
   - `app_opened`, `cloud_mode_enabled`, `session_run_completed`, `ai_draft_requested`, `ai_draft_accepted`.

---

## Task 5: AI Session Co-Pilot & Edge Function

### Objective
Create a Supabase Edge Function (`session-copilot`) that exposes conversational LLM tool-calling (`add_drill`, `update_drill_items`, etc.), validated by a shared Zod schema, with token cost tracking.

### Instructions for Agent
1. Create `supabase/functions/session-copilot/index.ts` (Deno / TypeScript).
2. Define Zod schemas matching `Session`, `Drill`, and `DrillItem[]` (`client/src/db/schema.ts`).
3. Implement LLM tool calling handling for differential updates (patches instead of full JSON rewrites to control costs).
4. Add token usage logging to the `llm_usage` table on every request.
5. Create UI component `client/src/components/AiSessionCopilotModal.tsx` combining a chat view on the left and live `SessionDetail` draft preview on the right.
6. Gate access: If `cloudModeEnabled` is false, show banner prompting coach to enable Cloud Mode in settings.

---

## Task 6: Swim School Multi-Coach Sharing

### Objective
Implement multi-tenant Swim School creation, coach role invitations, and RLS-enforced shared access to swimmers, session templates, and analytics.

### Instructions for Agent
1. Create `client/src/pages/SwimSchoolSettings.tsx`:
   - UI to create a "Swim School" organization or join via invite code.
   - Manage collaborator roles (`owner`, `head_coach`, `assistant_coach`).
2. Update DAO and API wrappers to filter queries by `school_id` when Cloud Mode and School membership are active.
3. Verify RLS policies in Supabase ensure coaches can only read/write swimmers and sessions belonging to their shared school.
