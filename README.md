# SwimSheet

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
└─────────────────────────┘
```

## Context Files

All project documentation is in `docs/context/`:

| File | Purpose |
|------|---------|
| `App-Context.md` | High-level architecture, PWA design, tech stack, routes |
| `DB-Context.md` | Data model, offline-first decisions, sync, schema |
| `UI-Context.md` | Design system, screen specs, component library |
| `Test-Context.md` | Testing stack, guidelines, known issues |
| `UI-Tasks-Context.md` | UI todo items (future GitHub issues) |
| `App-Tasks-Context.md` | App-level todo items (future GitHub issues) |

Archived plans and audits: `docs/archive/`

---

## Deployment (Docker)

The provided `Dockerfile` builds a single container that:

1. Installs dependencies for client and server
2. Builds the React client (Vite)
3. Builds the Express/TypeScript server
4. Copies the client build into the server's `public` folder
5. Starts the server on port 3001

### Run locally

```bash
# Build the image
docker build -t swim-sheet .

# Run container (data persisted in a volume)
docker run -d \
  --name swim-sheet \
  -p 3001:3001 \
  -v swimdata:/app/server/data \
  swim-sheet
```

Open your browser at `http://<host>:3001` (replace `<host>` with your device's IP when accessing from phone/tablet on the same network).

### Persistence

The SQLite file is stored at `/app/server/data/data.db` inside the container. The volume `swimdata` maps to that directory, ensuring data survives container restarts.

### Customizing the API URL (if needed)

The server serves both static files and API on the same origin, so the client uses relative URLs (`/api/...`). No extra configuration is required.

To change the port, set the `PORT` environment variable:

```bash
docker run -d -p 8080:8080 -e PORT=8080 --name swim-sheet -v swimdata:/app/server/data swim-sheet
```

---

## Development

For rapid iteration, you can run the client and server separately:

```bash
# Client
cd client
npm install
npm run dev   # Vite dev server

# Server
cd server
npm install
npm run dev   # tsx watch
```

The client dev server proxies `/api` to the server (configured in `vite.config.ts`) to avoid CORS during development.
