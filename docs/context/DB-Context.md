# SwimSheet DB Context

Index. The DB context was split into two focused docs:

- **Schema + entity tables + indexes + persistence/backup**:
  `docs/context/DB-Schema-Context.md`
- **Sync, RLS, tenant/identity, migrations, frozen-history snapshot**:
  `docs/context/DB-Sync-Context.md`

## Overview (one paragraph)

The client uses **Dexie (IndexedDB)** as its primary offline-first store and
optionally syncs selected tables with **Supabase Postgres**. The Express/
better-sqlite3 server is vestigial (unused by the client). The Supabase schema
mirrors synced client data with naming-convention differences (camelCase client,
snake_case cloud). Current Dexie schema version: **8** (v6 = camelCase migration,
v7 = additive, v8 = frozen history snapshot).

## Related
- Schema: `docs/context/DB-Schema-Context.md`
- Sync: `docs/context/DB-Sync-Context.md`
- Drill domain model: `docs/context/Drill-Model-Context.md`
- Session domain model: `docs/context/Session-Model-Context.md`