# SwimSheet Drills Screen Context

## Screen: DrillBank & DrillDetail

### Purpose
Global drill library and template management. Provides reusable drill templates that can be used across all sessions. Supports drill creation, editing, and library deduplication while maintaining template consistency.

### UI Components
- **DrillBank** (`client/src/pages/DrillBank.tsx`)
  - Hero with "Add Drill" button
  - Search bar with real-time filtering
  - Grid of drill cards with drill type, description, and options
  - Bulk actions: deduplicate, reset to defaults, seed library

- **DrillDetail** (`client/src/pages/DrillDetail.tsx`)
  - Individual drill template view with full options
  - Edit drill modal trigger
  - Usage count and related sessions display
  - Delete confirmation modal

- **DrillEditorModal** (`client/src/components/DrillEditorModal.tsx`)
  - Drill creation/edit form with all configurable options
  - Visual preview and option validation
  - Save/confirm logic

### User Flow
1. Navigate to DrillBank from Dashboard
2. Add new drill: Click "Add Drill" → Choose drill type → Configure options → Save
3. Edit drill: Click drill card → Click edit → Modify type or options → Save
4. Delete drill: Click drill card → Click delete → Confirm (affects only template)
5. Deduplicate library: Click "Deduplicate Drills" → Library cleaned up automatically
6. Reset to defaults: Click "Reset to Defaults" → Library restored to base library

### API Layer (Drills API)
**File**: `client/src/api/drills.ts`

Functions:
- `getSessionDrills(sessionId)`: Get drills for specific session
- `getDrill(id)`: Get single drill template
- `createDrill(data)`: Create new drill (SafeDrill type)
- `updateDrill(id, data)`: Update drill template (Partial<SafeDrill>)
- `deleteDrill(id)`: Delete drill template
- `listLibraryDrills()`: Get all library drill templates
- `createLibraryDrill(data)`: Create drill in library
- `updateLibraryDrill(id, data)`: Update library drill
- `deleteLibraryDrill(id)`: Delete library drill
- `patchLibraryDrills()`: Apply library changes
- `resetLibraryToDefaults()`: Restore base library
- `seedLibraryDrills()`: Seed with example drills
- `deduplicateLibraryDrills()`: Remove duplicate drill templates

**REST-like structure**:
```
GET    /drills/library            listLibraryDrills()
GET    /drills/:id                getDrill(id)
POST   /drills/library           createLibraryDrill(data)
PUT    /drills/library/:id        updateLibraryDrill(id, data)
DELETE /drills/library/:id        deleteLibraryDrill(id)
GET    /drills/session/:id        getSessionDrills(sessionId)
POST   /drills                   createDrill(data)
PUT    /drills/:id                updateDrill(id, data)
DELETE /drills/:id                deleteDrill(id)
PATCH  /drills/library            patchLibraryDrills()
POST   /drills/library/reset      resetLibraryToDefaults()
POST   /drills/library/seed       seedLibraryDrills()
POST   /drills/library/dedup      deduplicateLibraryDrills()
```

### Service Layer
**File**: `client/src/services/drillService.ts`

Responsibilities:
- Drill library CRUD operations
- Session drill association
- Drill deduplication logic
- Library defaults and seeding
- Drill type validation and option management

Key functions:
- `list()`: Retrieve all library drills
- `get(id)`: Get single drill template
- `create(data)`: Create drill in library
- `update(id, data)`: Update drill template
- `delete(id)`: Delete drill template
- `createLibrary(data)`: Library-specific create
- `updateLibrary(id, data)`: Library-specific update
- `deleteLibrary(id)`: Library-specific delete
- `patchLibrary()`: Apply bulk library changes
- `resetLibraryToDefaults()`: Restore default library
- `seedLibrary()`: Populate with example drills
- `deduplicateLibrary()`: Remove duplicate templates
- `getDrills(sessionId)`: Get drills for specific session

### Popularity Ranking Algorithm

Drills in the library carry a `popularity` counter that tracks how often coaches use them. The ranking is a simple usage-based metric:

| Source | Default Popularity | Rationale |
|---|---|---|
| `builtin` (pre-seeded) | 0 | Fresh out of the box, no usage yet |
| `personal` (coach-created) | 1 | Coaches who create custom drills are actively using the library |
| `customized` (edited builtin) | 1 | Modified drills indicate active engagement |

**How popularity is incremented:**
- +1 each time a coach adds a library drill to a session (via DrillBank → Add to Session)
- +1 only when a coach changes a drill's stroke and confirms "Save as New Variant" (via DrillEditorModal stroke-change confirm). A plain edit that keeps the stroke does **not** bump popularity.

**How ranking is used:**
- The "Popular" toggle chip in DrillBank sorts drills by `popularity` descending
- A `trending_up` badge appears on drill cards with `popularity > 0`
- The badge shows the raw count, giving coaches a quick signal of community usage

**Known limitations (see also: issue to enhance ranking):**
- The current algorithm is a simple counter — it does not decay old usage, weight by swimmer count, or distinguish between "added to session" vs "actually timed"
- There is no recency factor — a drill used 50 times 2 years ago ranks the same as one used 50 times today
- There is no personalization — all coaches see the same ranking regardless of their own usage patterns
- The `popularity` field is stored on the library drill record, not computed from session/run data

### Naming Convention

All drills default to **freestyle** stroke with a generic, technique-focused name. Stroke-specific variants are created by the coach editing the drill and changing the stroke — which triggers a "Save as New Variant" prompt that bumps the drill's popularity ranking. Choosing "Discard" instead closes the dialog and undoes the unsaved changes without bumping.

Examples of the naming pattern:
- `Single Arm` (freestyle default, was "One-Arm Backstroke")
- `Kicking on Side` (freestyle default, was "Kicking on Back")
- `Dolphin Kick` (freestyle default, was "Dolphin Kick on Back")
- `Pullout` (freestyle default, was "Breaststroke Pullout")
- `Body Motion` (freestyle default, was "Butterfly Body Motion")
- `Kick Only` (freestyle default, was "Breaststroke Kick Only")

This ensures the drill bank is scannable and stroke-agnostic by default.

Types:
- `Drill`: Drill template record
  - `id` (string): Unique identifier
  - `type` (string): Drill type (freestyle, backstroke, breaststroke, butterfly, mixed, etc.)
  - `name` (string): Drill name
  - `description` (string): Drill description/instructions
  - `options` (Record<string, unknown>): Drill-specific configuration options
  - `source` ('custom' | 'built-in'): Drill origin
  - `createdAt` (number): Unix timestamp
  - `updatedAt` (number): Unix timestamp

- `LibraryDrill`: Drill in global library (Drill without source or internal fields)
  - `id` (string): Unique identifier
  - `name` (string): Drill name
  - `type` (string): Drill type
  - `description` (string): Drill description
  - `options` (Record<string, unknown>): Drill options
  - `createdAt` (number): Unix timestamp
  - `updatedAt` (number): Unix timestamp

- `SafeDrill`: Editable drill record (Drill without source or internal fields)
  - Same as LibraryDrill

- `RunDrill`: Drill snapshot in a session run
  - `id` (string): Unique identifier
  - `sessionId` (string): Session this drill belongs to
  - `drillId` (string): Template drill this run drill was created from
  - `order` (number): Display order in session
  - `timingGroup` (number): Timing group assignment (0 = all, 1+ = specific group)
  - `data` (Record<string, unknown>): Run-specific drill data

- `SafeRunDrill`: Editable run drill (RunDrill without internal fields)

### Context Integration
- **Global Design**: Reusable templates that accelerate session creation
- **Duplicate Prevention**: `addLibraryDrill` upserts by name; `deduplicateLibraryDrills()` cleans up duplicates on load
- **Integration**: Session drills inherit from library templates; modifications affect future sessions only
- **Persistence**: Library CRUD works offline; templates can sync across devices

### Related Screens
- **SessionsList**: Source of drill templates for session creation
- **SessionDetail**: Edit drill order and timing groups
- **LiveDeck**: Use drills in active session run
- **SessionSetup**: Quick drill selection for new sessions