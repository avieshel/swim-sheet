# SwimSheet

Offline-first PWA for swim coaches to track lap times, stroke counts, and athlete progress.

All data lives in IndexedDB (via Dexie.js). No account, no backend dependency for core operations.

## Repo Structure

| Directory | Description |
|-----------|-------------|
| `client/` | React PWA — offline-first UI with Dexie/IndexedDB |
| `server/` | Express API & static file server (optional, not needed for Cloudflare) |
| `docs/` | Architecture, design, and planning documents |
| `tests/` | End-to-end Playwright tests |

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 |
| Router | React Router 7 |
| Styling | Tailwind CSS 4 |
| Database | Dexie 4 (IndexedDB) |
| PWA | vite-plugin-pwa (Workbox) |
| Build | Vite 6 / TypeScript 6 |
| Tests | Vitest (unit), Playwright (E2E) |
| Hosting | Cloudflare Pages |

## Local Development

```bash
# Terminal 1 — Client
cd client && npm install && npm run dev

# Terminal 2 — Server (optional, only if you need the sync API)
cd server && npm install && npm run dev
```

The client dev server proxies `/api` to the server (configured in `vite.config.ts`).

### Client Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | TypeScript check + production build to `dist/` |
| `npm run lint` | ESLint check |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run check` | Lint + typecheck + unit tests |

## Deployment (Cloudflare Pages)

Cloudflare Pages automatically builds and deploys the application when connected to this GitHub repository.

### Build Settings (configure in Cloudflare Pages dashboard)

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `client` |
| Node.js version | `22` |

No other configuration is needed — the `_headers` and `_redirects` files in `client/public/` are copied into the build output automatically.

### How it works

- **Production** — every push to `main` automatically deploys to your production domain.
- **Preview** — every push to a non-`main` branch creates a preview deployment with a unique URL.
- **CI quality gate** — the existing GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint, types, and tests on every push/PR to `main`. Deployments only proceed after passing CI.

### Custom Domain

In the Cloudflare Pages dashboard, go to **Custom domains** and add your domain. Cloudflare handles DNS, SSL, and CDN automatically.

## Releases

This project uses Git tags and GitHub Releases for versioning. No long-lived release branches.

### Creating a Release

```bash
# 1. Ensure main is up to date
git checkout main && git pull

# 2. Update version in client/package.json
#    (follow semver: v1.0.0, v1.1.0, v1.2.0, etc.)

# 3. Tag and push
git tag v1.2.0
git push origin v1.2.0

# 4. Create a GitHub Release from the tag
#    Go to https://github.com/OWNER/swim-sheet/releases/new
#    Select the tag, add release notes, publish
```

Pushing a tag triggers no deployment — only pushes to `main` do. Tags are for documentation and rollback reference.

### Version Information

The build embeds version info from `client/package.json` and the current Git commit SHA. Access it inside the app:

```ts
import { getAppVersion } from './utils/version'

const { version, commit, built } = getAppVersion()
// { version: "1.2.0", commit: "abc1234", built: "2026-07-09T18:32:00Z" }
```

## PWA Update Strategy

The service worker is configured with `registerType: 'prompt'` — updates download silently in the background without taking over.

1. User opens the app — the current version works immediately.
2. A new version is deployed — the new service worker downloads in the background.
3. When ready, a non-intrusive banner appears: *"A new version of Swim Sheet is available"* with **Update** and **Dismiss** buttons.
4. The user taps **Update** to activate the new version (the page reloads).
5. The user can tap **Dismiss** to continue with the current version — the update is applied on next reload.

All user data (IndexedDB) survives updates because it is stored separately from the app cache.

## Git Workflow

```
feature/*
      ↓
Pull Request
      ↓
main → Cloudflare Pages Production
       ↓
      Git Tags (v1.0.0, v1.1.0, …)
```

- `main` is always deployable.
- Feature branches create Cloudflare preview deployments automatically.
- PRs trigger CI (lint, typecheck, tests). Merge only when CI passes.
- Releases are tagged commits on `main` — no `develop` or `release` branches.

## Deployment (Docker) — Legacy

The server-based deployment is archived but still available. See [Dockerfile](./Dockerfile).

```bash
docker build -t swim-sheet .
docker run -d -p 3001:3001 --name swim-sheet swim-sheet
```

## Documentation

All project documentation lives in [docs/](./docs/), covering architecture, database schema, UI design, and task tracking.
