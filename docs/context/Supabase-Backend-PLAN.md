# SwimSheet — Supabase Backend Master Architecture & Implementation Plan

## Executive Summary

SwimSheet is currently a **local-first PWA** using Dexie (IndexedDB) for on-device storage. This plan introduces a **Supabase backend** as an **opt-in enhancement layer** while strictly preserving the **100% offline, zero-lockout local mode** as default for deck-side stopwatch operations.

---

## Architecture Principles

1. **Local-First Default (Deck-Side Integrity):** Live session timing, roster management, and local template editing run against local Dexie IndexedDB. Network drops never break or delay stopwatch/lap logging.
2. **Opt-In Cloud Enhancements:** A master toggle in `Settings` enables Supabase Auth, Cloud Sync, AI Session Co-Pilot, Product Analytics, and Multi-Coach Organization collaboration.
3. **Decoupled API Layer:** App UI calls wrappers in `client/src/api/` and `client/src/services/`. Pages never query Supabase directly; API wrappers route calls to Dexie locally or dispatch to Supabase when Cloud Mode is enabled.
4. **Conversational AI Co-Pilot with Tool Calling:** AI session building uses multi-turn chat + live draft preview. LLM output is constrained to granular Zod-validated tool calls (`add_drill`, `update_drill_items`, `reorder_drills`) rather than full JSON rewrites, maximizing quality while keeping token costs minimal.
5. **Multi-Tenant Identity (Organizations):** Role-Based Access Control (RBAC) powered by Postgres Row Level Security (RLS) enables coaches to work individually or join a shared "Organization" entity to share rosters, session templates, and telemetry.

---

## Modular Implementation Roadmap

| Task | Module | Scope & Objectives | Key Files |
| :--- | :--- | :--- | :--- |
| **Task 1** | Local CLI Setup & SQL Schema | Supabase CLI init, Postgres schema, RLS policies for multi-tenancy & organizations | `supabase/config.toml`, `supabase/migrations/*` |
| **Task 2** | Client Integration & Mode Toggle | Supabase JS client setup, Settings toggles (`cloudModeEnabled`, `analyticsOptIn`), Auth state hook | `client/src/api/supabase.ts`, `client/src/services/settingsService.ts`, `client/src/pages/Settings.tsx` |
| **Task 3** | Offline-First Sync Engine | Dexie mutation hooks, background queue worker, LWW conflict resolution | `client/src/sync/supabaseSyncEngine.ts`, `client/src/db/schema.ts` |
| **Task 4** | Product Analytics Telemetry | Event queueing service, privacy anonymizer, batch ingest Edge Function | `client/src/services/analyticsService.ts`, `supabase/functions/ingest-analytics/index.ts` |
| **Task 5** | AI Session Co-Pilot & Edge Function | Conversational session builder, Zod schema validation, Coaching rules guardrails, LLM tool calling | `supabase/functions/session-copilot/index.ts`, `client/src/components/AiSessionCopilotModal.tsx` |
| **Task 6** | Organization Multi-Coach Sharing | Organization creation modal, member invitations, RLS-enforced shared roster/templates | `client/src/pages/OrganizationSettings.tsx`, `client/src/services/organizationService.ts` |

---

## Detailed Task Card Instructions

See `docs/context/Supabase-Tasks.md` for individual, self-contained prompt cards that can be assigned directly to subagents or developer LLMs.
