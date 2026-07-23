# SwimSheet Live Deck Screen Context

## Screen: LiveDeck (Main Application Screen)

### Purpose
The primary command center for swim coaches during session execution. Allows real-time timing of swimmer laps, lane management, drill progress tracking, and instant feedback. This is where the core user value is delivered — managing the actual workout session.

### UI Components
- **LiveDeck** (`client/src/pages/LiveDeck.tsx`)
  - Main timing interface with lane clocks and swimmer progress
  - Active run display with session metadata
  - Real-time lap completion triggers
  - Control panel for timing groups, laps, and swimmer actions
  - Session completion and summary view

- **Timing Widgets**
  - **LapTimeline** (`client/src/components/timing/LapTimeline.tsx`)
    - Visual representation of lap completion status
    - Color-coded lane indicators for progress
    - Individual swimmer completion tracking

- **Modals**
  - **SwimmerFormModal** (`client/src/components/SwimmerFormModal.tsx`)
    - Quick swimmer addition for live timing
  - **DrillEditorModal** (`client/src/components/DrillEditorModal.tsx`)
    - Drill modification during session
  - **ConfirmDialog** (`client/src/components/ConfirmDialog.tsx`)
    - Confirmation for major actions

### User Flow
1. Start session: Open LiveDeck → Active run displayed (or click quick-start)
2. Setup timing: Configure lane count, timing groups, swimmer assignment
3. Execute session:
   - Click swimmer → Lap timer starts
   - Swimmer completes lap → Timestamp recorded, visual feedback
   - Continue timing multiple swimmers in sequence
4. Manage swimmers: Add new swimmer mid-session, remove, or swap
5. Track drills: Drill progress shown in timeline, completion triggers next drill
6. Complete session: Click complete → Run saved with all lap data → Summary displayed
7. Return to dashboard: Navigate back to manage templates or add new swimmers

### Swimmer Promotion (Temp → Roster)

When a coach uses a temp swimmer (`quick-*` dbId) to record times and later promotes
them to a real roster swimmer, the `promoteAndLinkSwimmer` service function is the
sole persistence path:

1. **Context update** (`SwimmerRows:onApply`): dispatches `UPDATE_SWIMMER_DBID` to
   the live context — UI feels instant.
2. **DB migration** (`finalizeSave → promoteAndLinkSwimmer`):
   - Replaces the synthetic dbId with the real roster dbId in ALL
     `laneDrillResults.data` JSON blobs for the run
   - Copies any existing lap entries from the JSON blob to the `laps` table
   - Removes the virtual swimmer from `SessionRun.notes.virtualSwimmers`
   - Adds the real swimmer to the `runSwimmers` table at the current lane
3. **Refresh** (`onSwimmerSaved`): Refetches `laneDrillResults` and the swimmer
   roster so the UI reflects the migrated data.

Key design decision: `onApply` in `SavedSwimmerRow` does NOT call
`updateLaneResultSwimmer` for promotion (dbId change) — only `promoteAndLinkSwimmer`
handles DB writes. This avoids races where `updateLaneResultSwimmer` changes the dbId
before `promoteAndLinkSwimmer` searches for it by the old id.

For pure edits (no dbId change, e.g. renaming a roster swimmer's name),
`onApply` calls `updateLaneResultSwimmer` directly (a fast local patch).

### API Layer (Runs API)
**File**: `client/src/api/runs.ts`

Functions:
- **Run Lifecycle**
  - `getActiveRun()`: Get currently active session run
  - `getRun(id)`: Get any completed or active run
  - `createRun(data)`: Start new session run
  - `updateRun(id, data)`: Update run metadata (pool, notes, etc.)
  - `completeRun(id)`: Finalize completed run
  - `completeRunWithLaps(runId, laps)`: Complete with lap data
  - `createRunFromTemplate(sessionId, data)`: Start run from template
  - `createQuickStartRun()`: Quick auto-start with default setup

- **Run Drills**
  - `getRunDrills(runId)`: Get drills for active session
  - `getRunDrill(id)`: Get specific run drill
  - `updateRunDrill(id, data)`: Modify run drill during session
  - `deleteRunDrill(id)`: Remove drill from session (end current drill early)

- **Run ↔ Swimmer**
  - `getRunSwimmers(runId)`: Get swimmers in current run
  - `getRunSwimmerLinks(runId)`: Get swimmer-lane associations
  - `addSwimmerToRun(runId, swimmerId, lane)`: Add swimmer to run
  - `removeSwimmerFromRun(runId, swimmerId)`: Remove swimmer from run
  - `getRunsForSwimmer(swimmerId)`: Get all runs for swimmer

- **Lane Results**
  - `getLaneResults(runId)`: Get all lane results by group
  - `getLaneResult(runId, groupId, runDrillId)`: Get specific lane result
  - `setLaneResult(data)`: Save lane result data
  - `deleteLaneResult(id)`: Remove lane result
  - `deleteLaneResultsForGroup(runId, groupId)`: Clear results for group
  - `deleteLaneResultsForRun(runId)`: Clear all run results
  - `deleteSwimmerFromLaneResult(...)`: Remove swimmer from lane result
  - `updateLaneResultSwimmer(...)`: Modify swimmer in lane result

- **Laps**
  - `getLapsForRunDrill(runDrillId)`: Get laps for drill
  - `getLapsForSwimmer(runId, swimmerId)`: Get laps for specific swimmer
  - `addLap(data)`: Add lap timestamp
  - `getAllLaps()`: Get all laps for run

### Service Layer
**File**: `client/src/services/runService.ts`

Responsibilities:
- Run lifecycle management (start, update, complete)
- Live timing coordination and state management
- Lane and timing group logic
- Lap recording and completion tracking
- Session-run relationship with swimmers

Key functions:
- `getActive()`: Retrieve active run
- `get(id)`: Get specific run
- `create(data)`: Start new run
- `update(id, data)`: Update run
- `complete(id)`: Mark run as completed
- `completeRunWithLaps(runId, laps)`: Complete with lap data
- `createFromTemplate(sessionId, data)`: Start run from session
- `createQuickStartRun()`: Quick session launch
- `getDrills(runId)`: Retrieve run drills
- `getDrill(id)`: Get run drill
- `updateDrill(id, data)`: Modify run drill
- `deleteDrill(id)`: Remove run drill
- `getSwimmers(runId)`: Get run swimmers
- `getRunSwimmers(runId)`: Get swimmer links
- `addSwimmer(runId, swimmerId, lane)`: Add swimmer
- `removeSwimmer(runId, swimmerId)`: Remove swimmer
- `getLaneResults(runId)`: Get lane results
- `setLaneResult(data)`: Save lane result
- `deleteLaneResult(id)`: Delete lane result
- `getLapsForRunDrill(runDrillId)`: Get laps
- `addLap(data)`: Add lap

### Data Structures
**File**: `client/src/db/schema.ts`

Types:
- `SessionRun`: Active or completed session run
  - `id` (string): Unique identifier
  - `sessionId` (string): Template this run was created from
  - `date` (string): Run date
  - `poolName` (string): Pool used for this run
  - `poolLength` (number): Pool length in meters
  - `drills` (RunDrill[]): Drills in sequence
  - `swimmers` (RunSwimmer[]): Swimmers in session
  - `laneResults`: Lane drill results by group
  - `laps`: Lap completion records
  - `status` ('active' | 'completed'): Session state
  - `createdAt` (number): Creation timestamp
  - `updatedAt` (number): Last update timestamp

- `RunDrill`: Drill in session run
  - `id` (string): Unique identifier
  - `sessionId` (string): Session this drill belongs to
  - `drillId` (string): Template drill source
  - `order` (number): Display order
  - `timingGroup` (number): Timing group assignment
  - `data` (Record<string, unknown>): Run-specific data

- `Swimmer`: Swimmer profile
  - `id` (string): Unique identifier
  - `name` (string): Swimmer name
  - `ageGroup` (string, optional): Age group
  - `strokes` (string[]): Stroke types
  - `equipment` (string[]): Equipment tags
  - `notes` (string, optional): Notes
  - `createdAt` (number): Creation timestamp
  - `updatedAt` (number): Last update timestamp

- `RunSwimmer`: Swimmer in session
  - `id` (string): Unique identifier
  - `runId` (string): Session run
  - `swimmerId` (string): Swimmer profile
  - `lane` (number): Lane assignment
  - `group` (number, optional): Timing group
  - `addedAt` (number): Added timestamp

- `LaneDrillResult`: Lane result for a drill and group
  - `id` (string): Unique identifier
  - `runId` (string): Session run
  - `groupId` (string): Timing group
  - `runDrillId` (string): Drill in session
  - `swimmers`: Array of swimmer results
  - `data`: Saved drill data with laps and splits

- `Lap`: Lap completion record
  - `id` (string): Unique identifier
  - `runDrillId` (string): Drill in session
  - `swimmerId` (string): Swimmer who completed lap
  - `timestamp` (number): Completion timestamp
  - `completedAt` (number): When recorded

- `SavedDrillData`: Serialized drill timing data
  - `drillStart` (number): Drill start timestamp
  - `drillEnd` (number): Drill end timestamp
  - `sessionStartedAt` (number): Session start time
  - `swimmers`: Array of swimmer lap data

### Context Integration
- **Global Design**: Primary screen where coaches get value — real-time session management
- **Tight Integration**: Swimmers, sessions, and drills all flow directly into live timing
- **Intuitive Workflows**: All actions (add swimmer, edit drill, start timing) accessible without leaving view
- **Instant Feedback**: Real-time timing, lap completion, and progress tracking visible immediately

### Related Screens
- **SessionsList**: Select session template to run
- **SwimmersList**: Add or edit swimmers before session
- **DrillBank**: Choose drill templates for session
- **CoachDashboard**: Home base before starting session
- **Settings**: Configure app preferences and equipment

### Key User Value
The Live Deck delivers core value by:
1. **Speed**: One-click session start from template
2. **Simplicity**: Clean interface with essential controls
3. **Flexibility**: Dynamic swimmer and lane management mid-session
4. **Feedback**: Real-time lap completion and timing group progress
5. **History**: Automatic save of all lap data for post-workout review