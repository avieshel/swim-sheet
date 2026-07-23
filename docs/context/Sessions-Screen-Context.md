# SwimSheet Sessions Screen Context

## Screen: SessionsList & SessionDetail

### Purpose
Primary template management interface for swim session templates. Allows coaches to create reusable session designs with drill sequencing, timing groups, and other configuration. Each session can be executed multiple times with independent run history.

### UI Components
- **SessionsList** (`client/src/pages/SessionsList.tsx`)
  - Hero with "Create Session" button
  - Search bar with real-time filtering
  - List of session cards with quick actions (edit, delete, run)
  - Date-based grouping for recent sessions

- **SessionDetail** (`client/src/pages/SessionDetail.tsx`)
  - Session template editor with drill drag-and-drop reordering
  - Timing group configuration (number of groups, split points)
  - Session metadata editor (name, pool, notes)
  - Save, delete, and run actions

- **SessionSetup** (`client/src/components/SessionSetup.tsx`)
  - Helper for new session creation from dashboard
  - Quick template selection and drill configuration
  - One-click session launch

- **DrillEditorModal** (`client/src/components/DrillEditorModal.tsx`)
  - Drill selection and modification for session
  - Reusable across session creation and editing

### User Flow
1. Navigate to SessionsList from Dashboard
2. Create new session: Click "Create Session" → Enter session name → Add drills → Configure timing groups → Save
3. Edit session: Click session card → Click edit → Modify drills or settings → Save
4. Delete session: Click session card → Click delete → Confirm (no effect on completed runs)
5. Run session: Click "Run" on session card → LiveDeck launches with session drills pre-loaded
6. View drill order: Drag-and-drop drills in SessionDetail to reorder

### API Layer (Sessions API)
**File**: `client/src/api/sessions.ts`

Functions:
- `listSessions()`: Get all session templates
- `getSession(id)`: Get single session template
- `createSession(data)`: Create new session (SafeSession type)
- `updateSession(id, data)`: Update session template (Partial<SafeSession>)
- `deleteSession(id)`: Delete session template
- `listCompletedRuns()`: Get historical session runs

**REST-like structure**:
```
GET    /sessions           listSessions()
GET    /sessions/:id       getSession(id)
POST   /sessions          createSession(data)
PUT    /sessions/:id      updateSession(id, data)
DELETE /sessions/:id      deleteSession(id)
GET    /sessions/completed listCompletedRuns()
```

### Service Layer
**File**: `client/src/services/sessionService.ts`

Responsibilities:
- Session template CRUD operations
- Run history tracking and retrieval
- Session-run relationship management
- Drill-to-session association

Key functions:
- `list()`: Retrieve all session templates
- `get(id)`: Get single session
- `create(data)`: Create new session template
- `update(id, data)`: Update session template
- `delete(id)`: Delete session template
- `getCompletedRuns()`: Retrieve completed run history
- `getRunsForSwimmer(id)`: Get sessions/runs for a specific swimmer

### Data Structure
**File**: `client/src/db/schema.ts`

Types:
- `Session`: Session template record
  - `id` (string): Unique identifier
  - `name` (string): Session name
  - `drillIds` (string[]): Array of drill IDs in sequence
  - `timingGroups` (number): Number of timing groups for live view
  - `poolName` (string, optional): Default pool name for runs
  - `poolLength` (number, optional): Default pool length in meters
  - `notes` (string, optional): Notes or instructions
  - `createdAt` (number): Unix timestamp
  - `updatedAt` (number): Unix timestamp

- `SessionRun`: Session execution instance (created when starting session)
  - `id` (string): Unique identifier
  - `sessionId` (string): Template this run was created from
  - `date` (string): Run date
  - `poolName` (string): Actual pool used for this run
  - `poolLength` (number): Actual pool length in meters
  - `drills` (RunDrill[]): Snapshot of drills at start
  - `swimmers` (RunSwimmer[]): Swimmers participating in this run
  - `laneResults`: Lane drill results for each group
  - `laps`: Lap completion records
  - `status` ('active' | 'completed'): Session state
  - `createdAt` (number): Creation timestamp

- `SafeSession`: Editable session record (Session without internal fields)

### Context Integration
- **Global Design**: Core CRUD templates that enable fast-session creation
- **Session-Run Model**: Templates are reusable; runs are independent snapshots
- **Integration**: Drills from session appear in live view; modification affects future sessions only
- **Persistence**: All CRUD works offline; session templates sync to server for multi-device sharing

### Related Screens
- **DrillBank**: Source of drill templates for session creation
- **SwimmerDetail**: Shows run history for swimmers
- **LiveDeck**: Entry point for running sessions