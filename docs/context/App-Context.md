# SwimSheet App Context

## Overview

Offline-first PWA for swim coaches to track lap times, stroke counts, and athlete progress. The server builds the React client and serves its static files, providing both the UI and the API.

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
| Sync | Custom sync engine | Last-write-wins with timestamps |
| Install | PWA manifest + SW | Add to home screen, full offline |
| Tests | Vitest (unit), Playwright (e2e) | Testing stack |

### Server

| Layer | Tech | Purpose |
|-------|------|---------|
| API | Express + TypeScript | REST CRUD endpoints at `/api/v1/*` |
| Static | Serves React build | Delivers the PWA to browsers |
| DB | better-sqlite3 | Zero-config, single file at `/app/server/data/data.db` |
| Schema | SQLite | Mirrors client Dexie schema with snake_case naming |

## Design Decisions

### Offline-First PWA
- The app works fully offline using IndexedDB (Dexie)
- The server is optional — needed for sync between devices and for first-time load
- PWA manifest enables "Add to Home Screen" on mobile
- Service worker caches static assets

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

### Two-Agent Workflow
- **Planner** (cloud model): Design, architecture decisions, task breakdown, code review
- **Coder** (local model): File creation, implementation, testing
- Planner creates PLAN.md with numbered tasks and shells out to Coder for each
- Coder self-reviews its own implementation

## Project Structure

```
SwimSheet/
├── client/
│   ├── src/
│   │   ├── api/            # API layer (unified Dexie + HTTP)
│   │   ├── components/     # Shared UI components
│   │   ├── constants/      # Shared constants (drill options, etc.)
│   │   ├── context/        # React context (LiveSessionContext)
│   │   ├── db/             # Dexie schema + DAO (pure CRUD)
│   │   ├── pages/          # Route page components
│   │   ├── services/       # Business logic services
│   │   ├── sync/           # Sync engine
│   │   ├── utils/          # Utility functions
│   │   └── App.tsx         # Root with routes
│   └── tests/              # E2E test directory
├── server/
│   └── src/
│       ├── db/             # SQLite schema + DAO
│       └── routes/         # Express route handlers
├── tests/                  # Playwright e2e tests
├── docs/context/           # Context files (this folder)
├── Dockerfile              # Single-container Docker build
├── README.md               # Project overview
└── playwright.config.ts
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | LiveDeck | Quick-time auto-start — active session runner (default entry) |
| `/live` | LiveDeck | Alias for `/` (legacy compatibility) |
| `/dashboard` | CoachDashboard | Home with hero, hub tiles, stats |
| `/swimmers` | SwimmersList | Roster grid with search |
| `/swimmers/:id` | SwimmerDetail | Individual swimmer profile |
| `/sessions` | SessionsList | Template list |
| `/sessions/:id` | SessionDetail | Template editor with drills |
| `/drills` | DrillBank | Global drill library |
| `/settings` | Settings | App preferences |

## Deployment

Single Docker container (see `Dockerfile`):
1. Installs dependencies for client and server
2. Builds the React client (Vite)
3. Builds the Express/TypeScript server
4. Copies client build into server's `public` folder
5. Starts server on port 3001

Development: run client (`npm run dev`) and server (`npm run dev`) separately. Client dev server proxies `/api` to server via Vite config.
