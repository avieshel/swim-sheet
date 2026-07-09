# Swimmers — Context & Architecture

## Purpose

The **Swimmers** feature is the roster of **students** registered by the coach. A swimmer represents an athlete being tracked through training sessions. This is distinct from a future concept of **application users** who might track their own progress; currently the coach is the sole data entry operator.

## Terminology

| Term       | Meaning                                                  |
|------------|----------------------------------------------------------|
| Swimmer    | A student/athlete registered by the coach                |
| User       | *(future)* An account that logs into the app, may be a swimmer tracking their own data |
| Coach      | The person operating the app, managing swimmers & sessions |

## Data Model

### Client (Dexie/IndexedDB)

| Field     | Type     | Notes                            |
|-----------|----------|----------------------------------|
| id        | string   | UUID                             |
| name      | string   | Required                         |
| group     | string   | Optional — e.g. "U17", "Masters" |
| notes     | string   | Optional — e.g. primary stroke   |
| createdAt | string   | ISO 8601                         |
| updatedAt | string   | ISO 8601                         |

### Server (SQLite)

| Field       | Type     | Notes                            |
|-------------|----------|----------------------------------|
| id          | TEXT PK  | UUID                             |
| name        | TEXT     | NOT NULL                         |
| group_name  | TEXT     | Maps to client `group`           |
| notes       | TEXT     |                                  |
| created_at  | TEXT     | ISO 8601                         |
| updated_at  | TEXT     | ISO 8601                         |

Naming discrepancy: client uses `group`, server uses `group_name`. Mapping is done in the DAO/swimmer routes.

## API (Server — `/api/v1/swimmers`)

| Method   | Path       | Description                                                  |
|----------|------------|--------------------------------------------------------------|
| `GET`    | `/`        | List swimmers with pagination (`limit`, `offset`), optional `name` and `group_name` filters (case-insensitive LIKE). Default limit 50, max 200. |
| `GET`    | `/:id`     | Get a single swimmer by ID. Returns 404 if not found.        |
| `POST`   | `/`        | Create a new swimmer. `name` is required. Returns 201 with the created record. |
| `PUT`    | `/:id`     | Update name, group_name, and/or notes. `name` is required. Returns 200. Returns 404 if not found. |
| `DELETE` | `/:id`     | Delete swimmer and cascade-delete all their sessions and laps. Returns 200. Returns 404 if not found. |

**Conflict resolution**: Last-write-wins based on `updated_at` / `updatedAt`. Every create/update sets the timestamp to the current time.

## Client Architecture

The client uses **Dexie** (IndexedDB) for offline-first CRUD. The DAO layer (`client/src/db/dao.ts`) provides:

- `getAllSwimmers()` — sorted by name
- `getSwimmer(id)` — single swimmer
- `addSwimmer(data)` — generates UUID, sets timestamps
- `updateSwimmer(id, data)` — partial update, bumps `updatedAt`
- `deleteSwimmer(id)` — removes from IndexedDB only (server sync is separate)

## UI Pages

### `/swimmers` — SwimmersList

Grid of swimmer cards with:
- Search bar (name/group), filter button
- Each card: avatar, name, group badge, notes, "View Stats" link, edit/delete buttons
- "Add New Swimmer" dashed card + FAB (mobile)
- Modal for add/edit with fields: Full Name, Group, Notes
- Empty state with "Add your first swimmer" CTA
- Delete via `confirm()` dialog

### `/swimmers/:id` — SwimmerDetail

- Profile header with inline editing of name and group
- List of session runs the swimmer participated in (links to run history) — **TODO**: show completed runs from RunSwimmer join
- Scoped for enhancement: general info section (e.g. goals, notes, primary events) that the coach populates over time

## Integration Points

### Sessions (`/sessions`, `/sessions/:id`)

The Sessions page is the **template manager**. Sessions are reusable blueprints with drills. No direct swimmer assignment at the template level — swimmers are assigned per **SessionRun** in the Live View.

### Live View (`/live`)

Swimmers are assigned to a SessionRun when the coach starts a session:
1. Coach picks a template
2. Sets date, pool name, pool length
3. Adds swimmers from the roster and assigns them to lanes
4. `RunSwimmer` records the link between swimmer, run, and lane
5. Lap data recorded during the live session links to `RunDrill` and references the swimmer's `id`

The live view should fetch `getAllSwimmers()` and present a picker (searchable dropdown or lane assignment modal). Strokes, splits, and effort logged per swimmer during a live session should reference the swimmer's `id`.

### Coach Dashboard (`/`)

The dashboard header shows `{swimmers.length} active swimmers`. Uses the swimmers API for this count. Also shows template count and completed run stats.

## Sync System

The `sync/` directory on the server is reserved for future bi-directional sync. The current implementation uses IndexedDB locally and Express + SQLite on the server with identical CRUD routes. The `updatedAt` field on both sides supports the last-write-wins strategy described in CONTEXT.md.

## Future: Users vs Swimmers

Currently **swimmers are not users** — they are data records managed entirely by the coach. In a future iteration:
- A swimmer could have an associated user account
- That user could view their own progress (read-only or limited write)
- The coach would retain full CRUD control
- The API would need auth middleware to enforce this boundary
