# SwimSheet App Context

## Overview

Offline-first PWA that lets swim coaches manage their data (swimmers, session templates and their drills) and track live sessions to record actual training data per swimmer. The server builds the React client and serves its static files, providing both the UI and the API.

**Optional cloud features** — a coach can sign in with their Google account to sync data across devices and use AI session generation (Supabase Edge Function + `shared/sessionDraft/` contract). Collaboration between coaches is currently via manual session-template import/export (`.swimsheet` packages). Server-backed sharing with other coaches is planned but **not built** (design in `docs/context/Session-Sharing-Design.md`).

## Architecture

```
┌─────────────────────────┐
│       Server            │
│  (Express + TS)         │
│  ├─ API: /api/v1/*      │
│  └─ Static: client build│
└─────────────────────────┘
        ▲
        │ HTTPS/HTTP
        │
┌─────────────────────────┐
│   Mobile/Tablet Browser │
│   (SwimSheet PWA)       │
│   └─ Dexie (IndexedDB)  │
└─────────────────────────┘
```

### Client

| Layer | Tech | Purpose |
|-------|------|---------|
| UI | React 19 + TypeScript | SPA for mobile browser |
| Build | Vite | Fast dev + PWA plugin |
| Routing | react-router-dom v7 | Client-side routing |
| Offline DB | Dexie.js 4 | IndexedDB wrapper — typed, queryable |
| API | Custom `api/` wrappers | Consistent interface over Dexie + HTTP |
| Services | Domain services | Business logic (runService, swimmerService, etc.) |
| Sync | Custom Supabase sync engine | Bidirectional sync for selected tables; push local edits, pull remote changes, and surface conflicts |
| Install | PWA manifest + SW | Add to home screen, full offline |
| Tests | Vitest (unit), Playwright (e2e) | Testing stack |
| Static analysis | ESLint + tsc + knip | Lint, typecheck, dead-code detection (`npm run check`) |

### Server

| Layer | Tech | Purpose |
|-------|------|---------|
| API | Express + TypeScript | REST CRUD endpoints at `/api/v1/*` |
| Static | Serves React build | Delivers the PWA to browsers |
| DB | better-sqlite3 | Zero-config, single file at `/app/server/data/data.db` |
| Schema | SQLite | Mirrors client Dexie schema with snake_case naming |

## Design Decisions

### Product Design Principles
- **Consistent management pattern** across the three domains: List view (SwimmersList / SessionsList / DrillBank) → Create/Edit modal (SwimmerFormModal / SessionMetadataModal / DrillEditorModal) → Detail view (SwimmerDetail / SessionDetail). Drills are edited via a detail *modal*, not a detail page.
- **Swimmer data is deliberately minimal**: `name, group, labels, notes, status` — no age, DOB, strokes, or equipment fields (privacy stance; see `docs/context/UI-Context.md`).
- **Drills are copy-on-use**: starting a session copies library drills into the session/run. A `libraryDrillId` soft reference records provenance only — edits never propagate back to the library or forward to other sessions.
- **Session swimmer lists are independent of the global roster**: temp (`quick-*`) swimmers exist inside a run and are promoted or discarded at completion; run history is frozen and unaffected by later swimmer or template changes.
- **Deleting a session template has no effect on completed run history** (frozen snapshot).

### Offline-First PWA
- The app works fully offline using IndexedDB (Dexie)
- Supabase is optional — needed only for account-based cloud sync; core app data remains available offline
- PWA manifest enables "Add to Home Screen" on mobile
- Service worker caches static assets only (never API responses)
- **First run is always clean**: the client seeds only builtin templates (drill library, session catalog); it never contains or downloads previous/completed-session data. All coach session data is stored on the device.

### Client-Layer Architecture
The client follows a four-layer architecture (enforced since architecture review):

```
UI (pages/) → API (api/) → Services (services/) → DAO (db/dao.ts) → Dexie
```

- **UI**: Pages and components. Never imports `dao.ts` or Dexie directly.
- **API**: Unified client that wraps both local Dexie operations and server HTTP calls. Pages call API functions.
- **Services**: Business logic (session lifecycle, timing calculations, drill enrichment). Called by API layer.
- **DAO**: Pure CRUD — no business logic. Only data access.
- **DB**: Dexie schema + type definitions only.

### Session (Template) → SessionRun (Instance) Model
Sessions are reusable templates. When a coach starts a session on the Live page, a SessionRun is created which snapshots the template's drills into RunDrill records. This preserves historical data independently of template changes.

### Timed Groups (Live View)
The live view uses Timed Groups instead of a single global timer. Each group has its own independent clock. Groups can be split (duplicating timer state), swimmers can be moved between groups, and multiple groups can share a physical lane.

### Duplicate Drill Prevention & Dedup

`addLibraryDrill` (DAO) upserts by name — if a drill with the same name exists, it updates the existing record instead of creating a duplicate. This prevents the main source of duplicates: `addDrill` auto-saving session drills to the library.

On DrillBank load, `deduplicateLibraryDrills()` runs as a one-time cleanup: it groups library drills by exact name, keeps the most complete entry (preferring built-in source), and deletes the rest.

## Project Structure

```
SwimSheet/
├── client/
│   └── src/
│       ├── api/            # API layer (unified Dexie + HTTP)
│       ├── components/     # Shared UI components (ai/, live/, session/ subgroups)
│       ├── constants/      # Shared constants (drill options, etc.)
│       ├── context/        # React context (AuthProvider, LiveSessionContext)
│       ├── data/           # Builtin seed data (drills.json, session catalog)
│       ├── db/             # Dexie schema + DAO (pure CRUD)
│       ├── hooks/          # UI-adjacent logic (useActiveRun, useStartLiveSession)
│       ├── i18n/           # Locale/format helpers
│       ├── pages/          # Route page components
│       │   └── live/       # ActiveRunView (live session runner) — split from LiveDeck
│       ├── services/       # Business logic services (incl. sessionDraft/, sessionPackage/)
│       ├── sync/           # Sync engine (Supabase transport)
│       ├── timing/         # Client-side timing helpers
│       ├── utils/          # Utility functions
│       └── App.tsx         # Root with routes
├── server/
│   └── src/
│       ├── db/             # SQLite schema + DAO
│       └── routes/         # Express route handlers (swimmers, sessions, laps)
├── shared/                 # Runtime-agnostic contracts (sessionDraft/, sessionPackage/)
├── supabase/               # Migrations + ai-session-harness Edge Function + evals
├── tests/                  # Playwright e2e tests (root)
├── docs/context/           # Context files (this folder)
├── Dockerfile              # Single-container Docker build
├── README.md               # Project overview
└── playwright.config.ts
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | LiveDeck | App home — live picker (no auto-start): pinned "100m freestyle quick time" option + templates ranked by usage; resumes an active run. PWA `start_url` |
| `/about` | Landing | Public marketing page (hero, features, how-it-works, FAQ + FAQ JSON-LD). Indexable — the only route in `sitemap.xml`. Rendered outside `Layout` |
| `/privacy` | Privacy | Public Privacy Policy. Indexable. Rendered outside `Layout` |
| `/terms` | Terms | Public Terms of Service. Indexable. Rendered outside `Layout` |
| `/live` | LiveDeck | Live session screen (session flows `navigate('/live')` when starting a run); alias of `/` |
| `/dashboard` | CoachDashboard | Home with hero, hub tiles, stats |
| `/swimmers` | SwimmersList | Roster grid with search |
| `/swimmers/:id` | SwimmerDetail | Individual swimmer profile |
| `/sessions` | SessionsList | Template list |
| `/sessions/catalog` | CatalogScreen | Session template catalog |
| `/sessions/ai` | AiSessionDraft | AI session generation (gated on sign-in; produces a session via the `shared/sessionDraft` contract) |
| `/sessions/:id` | SessionDetail | Template editor with drills |
| `/auth/callback` | AuthCallback | OAuth redirect handler for Google sign-in |
| `/drills` | DrillBank | Global drill library |
| `/settings` | Settings | App preferences |
| `/runs` | RunsHistory | Completed run history |
| `/runs/:id` | RunDetail | Single run results |

**SEO:** `client/src/utils/routeMeta.ts` (pure resolver + unit tests) maps each path to title, description, canonical, and indexability; `client/src/components/RouteMeta.tsx` applies it on navigation. The landing page (`/about`) and the two legal routes (`/privacy`, `/terms`) are indexable; all app routes (including `/`) emit `<meta name="robots" content="noindex, nofollow">` so private screens stay out of search results. `client/public/robots.txt` allows crawling and points at `sitemap.xml` (landing + legal). Static head meta (description, Open Graph, Twitter, canonical) lives in `client/index.html` and points at `/about`. App routes are wrapped by `Layout` as a pathless layout route (Outlet); `/about`, `/privacy`, and `/terms` render outside it. These three paths must be listed in `client/public/_redirects` or Cloudflare Pages returns a real 404.

## Deployment

Single Docker container (see `Dockerfile`):
1. Installs dependencies for client and server
2. Builds the React client (Vite)
3. Builds the Express/TypeScript server
4. Copies client build into server's `public` folder
5. Starts server on port 3001

The server creates a fresh SQLite DB at runtime (`/app/data/data.db`) — it is empty on boot. The local dev DB under `server/data/` (which may contain previous session data) is excluded from the Docker build context via `.dockerignore`, so it can never be baked into a downloaded image. Client data is never bundled either; the only static data shipped is builtin drill/session catalog templates.

Development: run client (`npm run dev`) and server (`npm run dev`) separately. Client dev server proxies `/api` to server via Vite config.

Supabase client config is mode-specific at the repository root because `client/vite.config.ts` uses `envDir: '..'`: local Docker values live in the ignored `.env.development.local`, hosted local-production values may live in the ignored `.env.production.local`, and `.env.example` documents the required variables. The root `.env` contains no Supabase credentials. `client/src/config.ts` intentionally does not read Supabase configuration from localStorage, preventing stale hosted values from overriding the active Vite mode. The value for `VITE_SUPABASE_ANON_KEY` is the Supabase **publishable** key (`sb_publishable_...`), never the secret key. CI reads hosted values from GitHub Actions secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). `AuthProvider` wraps the application router, restores the Supabase session on startup, and exposes auth status, user, persistence preference, and auth actions through `useAuth`; it does not access Dexie. Supabase CLI runs `supabase/seed.sql` against the local Docker `postgres` database only — never against hosted projects (the CLI does not apply seed files to linked remote databases; hosted pushes use migrations via `supabase db push`). The seed creates a local-only `auth.users` row (`dev@swimsheet.local`) so the in-app dev test-user sign-in works after `npx supabase db reset`. The matching `public.profiles` row is created automatically by the existing `handle_new_user` trigger. This file intentionally has no runtime environment guard — it relies on the Supabase CLI's standard behavior (`db reset` local only, `db push` never runs seed).
