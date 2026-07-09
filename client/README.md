# SwimSheet Client — Offline-First PWA

The client is a **Progressive Web Application** for swim coaches to plan workouts, run live timing sessions, and track athlete progress. It is designed to work **offline-first**: all data lives in IndexedDB (via Dexie.js), and the UI is fully functional without a network connection.

## Key Architecture Decisions

### Offline-First

- **All CRUD** reads and writes go through Dexie/IndexedDB — no server dependency for core operations.
- **Sync** is push/pull on demand: local changes are posted to the REST API, and server data is merged back. Sync is triggered manually from the UI (see `src/sync/syncEngine.ts`).
- **Schema** defines 10 object stores (swimmers, sessions, drills, sessionRuns, runDrills, runSwimmers, laps, laneDrillResults, libraryDrills, meta) — see `src/db/schema.ts`.

### PWA

- Built with `vite-plugin-pwa` (Workbox) — all static assets are precached.
- Installable on mobile/desktop with `display: standalone` and `orientation: portrait-primary`.
- Google Fonts cached at runtime (CacheFirst, 1-year expiry).
- Update prompt when a new service worker is detected (`src/components/UpdatePrompt.tsx`).

### Live Timing Deck

The core coaching feature is the live timing view (`/live`). Coaches:
- Assign swimmers to lanes (up to 8)
- Start per-lane timers and tap to record lap splits
- Capture stroke counts and effort levels
- Mark individual swimmer completion
- Split groups, move swimmers between lanes, and set drill overrides

### Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 |
| Router | React Router 7 |
| Styling | Tailwind CSS 4 |
| Database | Dexie 4 (IndexedDB) |
| PWA | vite-plugin-pwa (Workbox) |
| Build | Vite 6 / TypeScript 6 |
| Tests | Vitest (unit), Playwright (E2E) |

## Development

```bash
npm install
npm run dev      # Vite dev server (port 5173)
npm run test     # Vitest
npm run lint     # ESLint
```

The dev server proxies `/api` to the backend server (configured in `vite.config.ts`).

## Building

```bash
npm run build    # TypeScript + Vite production build
```

Output goes to `dist/`, which the server serves as static files.

## Learn More

- Architecture docs: [docs/](/docs/)
- DB schema & sync: `src/db/schema.ts` and `src/sync/syncEngine.ts`
- Component tree: `src/App.tsx`