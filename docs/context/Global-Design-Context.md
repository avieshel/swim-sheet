# SwimSheet Global Design Context

## Overview

SwimSheet is designed to give swim coaches **instant value** by enabling full CRUD control over all parameters and tightly integrating management actions (adding swimmers, updating sessions, creating drills) with the live session management screen. The goal is to eliminate friction so coaches can focus on training, not app configuration.

## Core Design Philosophy

### Fast Path to Value
- **Zero learning curve**: Coach can start using the app immediately by adding their first swimmer and first session
- **Intuitive workflows**: Management actions (add/edit swimmers, sessions, drills) open modals that feel natural to swim coaches
- **Direct feedback**: Changes to swimmers and sessions immediately reflect in the live session screen
- **One-click setup**: Templates and presets reduce the amount of data entry required

### Unified Management Model
All three core domains (swimmers, sessions, drills) follow the same pattern:
1. **List View** (e.g., SwimmersList, SessionsList, DrillBank)
2. **Create/Edit Modal** (e.g., SwimmerFormModal, SessionFormModal, DrillEditorModal)
3. **Detail View** (e.g., SwimmerDetail, SessionDetail, DrillDetail)

This consistency reduces cognitive load and makes the app feel familiar across all management screens.

### Tight Integration with Live View
The live session screen is the **command center** for a swim coach's session:
- Active session from template → SessionRun with copied drills
- Swimmers added via UI → immediately appear in live timing lanes
- Drill modifications → update both library and current session drills
- Real-time timing → live view updates instantly as swimmers complete laps

### CRUD-First Architecture
Every entity is fully editable:
- Swimmers: Add, edit, delete with full profile (name, age group, strokes, equipment, notes)
- Sessions: Template-based creation with drill sequencing and timing group settings
- Drills: Template library with custom options, stroke types, equipment requirements
- Runs: Instantiation of sessions with live timing, lap recording, and completion

### Offline-First Behavior
All management actions (CRUD) work fully offline using IndexedDB. Changes sync when connection is restored. This ensures coaches can always manage their roster and sessions, even in areas with poor connectivity.

## User Journey Overview

### First Time Setup
1. Coach opens app → sees Welcome/Splash screen
2. Adds first swimmer (or multiple) via SwimmersList
3. Creates first session template via SessionsList
4. Selects session in LiveDeck (quick-time auto-start) or sets up from scratch
5. Adds drills to session, configures timing lanes
6. Starts session, begins live timing

### Regular Session Flow
1. Opens LiveDeck → sees active session
2. Adds/removes swimmers, adjusts lanes as needed
3. Runs session, tracks lap times and stroke counts
4. Completes session → data saved to run history
5. Returns to management screens to modify template or add new swimmers

### Data Management
1. Edit swimmer profile → updates in all sessions/runs
2. Modify drill → auto-saves to library and updates any active sessions
3. Delete swimmer → confirmation, data retained in run history
4. Delete session template → no effect on completed run history

## Key Integration Points

### Swimmers ↔ Sessions
- Swimmers can be added to a session before starting
- Swimmers persist across session runs even if original swimmer is deleted
- Session swimmer list is independent of global swimmer roster
- Each session run tracks which swimmers participated

### Sessions ↔ Drills
- Sessions inherit drills from templates via SessionRun snapshot
- Drill modifications in template affect future sessions only
- Session can have custom drills added beyond template
- Run drills are independent of template drills after session starts

### Drills ↔ Runs
- Library drills are reusable templates for all sessions
- Library drill modifications apply globally
- Session drills are tied to the specific session instance
- Drill types define timing group behavior and visual presentation

### Runs ↔ Live View
- Live view displays current run only
- Active run tracks real-time timing via lane clocks
- Swimmer progression managed through timing groups
- Lap completion triggers visual feedback and data persistence