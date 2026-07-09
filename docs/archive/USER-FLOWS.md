# SwimSheet User Flows

## Overview

This document details all user workflows for the SwimSheet coaching application.

---

## Core User Flows

### 1. Coach Onboarding & Setup Flow

**Purpose**: New coach creates account and configures initial settings

**Prerequisites**: None

**Steps**:
1. Navigate to `/` (Coach Dashboard)
2. Complete initial splash screen/boarding flow
3. Set team name and pool details
4. Configure notification preferences
5. Review and accept coaching terms

**Error Handling**:
- Pool length must be positive number
- Team name cannot be empty

**Success Criteria**:
- Settings saved to local database
- Dashboard displays team name
- Notifications enabled if requested

---

### 2. Team Management Flow

**Purpose**: Coach adds, edits, and manages swimmers

**Prerequisites**: Coach account configured

**Steps**:
1. Navigate to `/swimmers`
2. Search by name or filter by group
3. Click "Add Swimmer" (FAB or card)
4. Fill in swimmer details:
   - Name: Required
   - Group: Optional (e.g., U17, Masters)
   - Notes: Optional (primary stroke, goals)
5. Save swimmer
6. View swimmer in grid
7. Optionally edit swimmer details
8. Optionally delete swimmer

**Error Handling**:
- Duplicate names detected
- Empty required fields
- Delete confirmation dialog

**Success Criteria**:
- Swimmer appears in list
- Details match input
- Search filters work correctly

---

### 3. Session Template Management Flow

**Purpose**: Coach creates and edits reusable session templates (blueprints)

**Prerequisites**: Swimmers created (optional — swimmers not needed at template level)

**Steps**:
1. Navigate to `/sessions`
2. View list of existing templates
3. Click "New Template" to create one
4. Set template name (e.g., "Tuesday Endurance")
5. Set default pool length
6. Add drills from the drill library:
   - Name, stroke type, distance
   - Drills appear in an ordered list
7. View real-time totals: total distance, stroke breakdown, drill count
8. Reorder drills (future: drag-and-drop)
9. Save template
10. Click on existing template to edit name, pool length, or drills

**Error Handling**:
- Template name required
- Valid distance values
- Drill name required

**Success Criteria**:
- Template saved with all drills
- Totals view accurate
- Templates listed on sessions page

---

### 4. Live Session Flow (Start & Run)

**Purpose**: Coach runs a live training session based on a template

**Prerequisites**: At least one session template exists; swimmers exist in roster

**Steps**:
1. Navigate to `/live`
2. If no active run, see **Session Setup**:
   a. Pick a template from the list
   b. Set date (default today)
   c. Set pool name (e.g., "Olympic Pool")
   d. Adjust pool length if needed (pre-filled from template)
   e. Add swimmers from roster, assign to lanes
3. Click "Start Session" → creates SessionRun + snapshots drills into RunDrills
4. **Active Run** — Live Deck with:
   a. Per-lane stopwatches (start/pause/reset per lane)
   b. Per-swimmer controls: Start, Lap (with time), Stroke Count, Complete
   c. Current drill context (which RunDrill is active)
   d. Lap data recorded against RunDrill per swimmer
5. Click "Complete Session" → saves all data, status = `completed`

**Error Handling**:
- No template selected
- No swimmers assigned to lanes
- No drills in template (warn but allow)

**Success Criteria**:
- SessionRun created with correct data
- RunDrills snapshot created from template drills
- Lap data recorded and persisted
- Session completes and shows in history

---

### 5. Session History Review Flow (future)

**Purpose**: Coach reviews completed training sessions

**Prerequisites**: Completed SessionRuns with lap data

**Steps**:
1. Navigate to completed runs view (future `/history` or filter on `/sessions`)
2. Browse past runs by date
3. Click a run to see details:
   - Which template was used
   - Swimmers and lane assignments
   - Drills performed (snapshot at time of run)
   - Lap times per swimmer per drill
4. Review per-swimmer stats (future)

**Success Criteria**:
- Historical data accurate
- Template changes don't affect past runs
- Lap data viewable per swimmer per drill

---

### 6. Live Deck Coaching Flow

**Purpose**: Coach conducts real-time swim practices

**Prerequisites**: Active session run with lane assignments

**Steps**:
1. Start lane timers
2. Start individual swimmers (records offset from lane timer)
3. Record lap splits per swimmer
4. Note stroke counts per lap
5. Complete swimmers individually
6. Complete the session
7. Review elapsed data

**Error Handling**:
- No swimmers assigned to lanes
- Invalid start times
- Timer synchronization issues

**Success Criteria**:
- Timer records accurately
- Lap data saved per swimmer
- Session finalized correctly

---

### 7. Swimmer Performance Tracking Flow

**Purpose**: Coach views and analyzes swimmer performance

**Prerequisites**: Completed session runs with lap data

**Steps**:
1. Navigate to `/swimmers` and select swimmer
2. View swimmer overview:
   - Summary stats
   - Recent session runs
   - Best times
3. View detailed performance
4. Filter by date range

**Success Criteria**:
- Performance data displays
- Session runs linked to swimmer

---

### 8. Real-Time Synchronization Flow

**Purpose**: Coaches sync data between devices

**Prerequisites**: Coaches with multiple devices

**Steps**:
1. Add new swimmer or session on device A
2. Wait for sync trigger
3. Check sync status indicator
4. Review conflict resolution
5. Verify data appears on device B

**Error Handling**:
- Sync timeout
- Conflict resolution needed
- Network interruption

**Success Criteria**:
- Data syncs successfully
- Conflicts resolved correctly
- Both devices have same data

---

### 9. Mobile First Flow

**Purpose**: Coach uses SwimSheet on mobile devices

**Prerequisites**: Mobile device with browser

**Steps**:
1. Open SwimSheet app
2. Navigate using bottom nav bar
3. Access features with touch targets
4. Use FAB buttons for primary actions
5. Swipe and scroll within panels
6. Check responsive design

**Success Criteria**:
- App works smoothly on mobile
- Navigation intuitive
- All features accessible

---

### 10. Dashboard Overview Flow

**Purpose**: Coach gets quick stats and navigation

**Prerequisites**: Any user logged in

**Steps**:
1. Navigate to `/` (Dashboard)
2. View hero section (today's focus)
3. Check hub tiles (Team, Sessions, Live)
4. Review stats grid (volume, team status)
5. Navigate to features via tiles or nav

**Success Criteria**:
- Dashboard renders correctly
- Stats current and accurate
- Easy navigation

---

### 11. Settings & Preferences Flow

**Purpose**: Coach configures app preferences

**Prerequisites**: Any user logged in

**Steps**:
1. Navigate to Settings at `/settings`
2. Configure profile settings
3. Set notification preferences
4. Customize theme
5. Manage app sync settings
6. Review data management options

**Success Criteria**:
- Settings saved
- Preferences applied
- No errors in save

---

## Testing Checklist

For each flow, verify:
- [ ] All steps complete successfully
- [ ] Error handling works as expected
- [ ] UI renders correctly in all contexts
- [ ] Data persists as expected
- [ ] Responsive design works
- [ ] Sync functionality operates
- [ ] Performance is acceptable
- [ ] Accessibility standards met
- [ ] User feedback is clear
- [ ] Documentation is accurate

---

## Future Enhancements

### Planned Flows
- [ ] Voice command integration for deck management
- [ ] Video drill library with augmented reality
- [ ] Team messaging and notifications
- [ ] Cloud storage for backup and sync
- [ ] Advanced analytics and AI insights
- [ ] Multi-coach team management
- [ ] Mobile app native installation
- [ ] Offline mode with full functionality
- [ ] Data visualization enhancements
- [ ] Team collaboration features

### Considerations
- Integrate with wearable fitness devices
- Support international swim standards
- Add accessibility features for differently-abled coaches
- Implement advanced security and privacy features
- Create customizable dashboards
- Add social features for team community
