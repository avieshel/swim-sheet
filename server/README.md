# SwimSheet Server

Work in progress — Express + TypeScript API and static file server.

## Planned

- REST API at `/api/v1/*` for syncing client data
- SQLite persistence (via better-sqlite3)
- Serves the built client from `client/dist/`

## Development

```bash
npm install
npm run dev      # tsx watch (hot reload)
```

## Build

```bash
npm run build && npm start
```