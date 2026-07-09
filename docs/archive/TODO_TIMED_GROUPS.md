# Timed Groups Migration Status

## Completed So Far
- [x] **Enriched Drill Model:** Support for complex sets, pyramids, intervals, and equipment.
- [x] **Rich Drill Editor:** Wide, single-line spreadsheet-style modal for set building.
- [x] **Drill Bank Management:** Global library with search, filtering by technical labels, and auto-patching.
- [x] **Themed UI:** Custom Selects and Confirm Dialogs implemented throughout the app.
- [x] **Session Layout:** Updated to a 50/50 workspace split.
- [x] **Database Schema v6:** Added `group_id` to `LaneDrillResult` to support multiple timers per physical lane.

## Tasks to Complete (Split/Squash Functionality)
- [x] **Context Refactor:** Rename `Lane` to `TimedGroup` in `LiveSessionContext.tsx` and ensure every group has a unique UUID.
- [x] **Timer Sync Logic:** Implement `SPLIT_GROUP` action that duplicates active timer state (startTime/running) to new groups.
- [x] **DAO Update:** Update `setLaneDrillResult` and `getLaneDrillResult` to use `group_id` as the primary lookup key.
- [x] **Edit Deck Mode:**
    - [x] Create a "Toggle Edit Mode" in `LiveDeck.tsx`.
    - [x] Add swimmer selection checkboxes/handles.
    - [x] Implement the "Split to New Group" action bar.
- [x] **Group Management:**
    - [x] Implement inline renaming for Timed Groups.
    - [x] Implement physical lane number reassignment.
    - [ ] Support drag-and-drop or manual reordering of Group Cards.
- [ ] **Swimmer Mobility:** Implement `MOVE_SWIMMER_TO_GROUP` with automatic reset of timing data for the destination group.
- [ ] **UI Polish:** Visual clustering of groups that share the same physical lane.
