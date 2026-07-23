# SwimSheet Coach Dashboard Screen Context

## Screen: CoachDashboard

### Purpose
The central navigation hub for SwimSheet coaches. Serves as the entry point for session management, drill editing, and session template creation. Provides quick access to all major app functionalities through a clean, card-based interface.

### UI Components
- **CoachDashboard** (`client/src/pages/CoachDashboard.tsx`)
  - Welcome banner with user greeting
  - Quick action cards for common tasks
  - Recent sessions preview
  - Navigation to different management screens

- **SessionSetup** (`client/src/pages/SessionSetup.tsx`)
  - Full session creation wizard
  - Template selection and customization
  - Roster assignment and lane configuration
  - Quick-start options

### User Flow
1. Navigate to CoachDashboard from Home or QuickStart
2. View quick action cards (Create Session, View Drills, View Swimmers)
3. Access SessionSetup for structured session creation
4. Navigate to specific management screens via cards or navigation
5. Return to dashboard to access other features

### Navigation Structure
```
CoachDashboard ( / )
├── SessionSetup ( /session-setup )
│   ├── Template selection
│   ├── Roster assignment
│   └── Lane configuration
├── SwimmersList ( /swimmers )
├── SessionsList ( /sessions )
├── DrillBank ( /drills )
├── LiveDeck ( / )
│   └── Quick-time session entry
└── History/Review ( /history )
```

### API Layer
**File**: `client/src/api/dashboard.ts`

Functions:
- `getSessionTemplates()`: Get session templates for quick selection
- `getRecentActivities()`: Get recent runs or swimmers activity
- `getQuickActions()`: Get personalized quick action suggestions

### Service Layer
**File**: `client/src/services/dashboardService.ts`

Responsibilities:
- Dashboard data aggregation
- Recent activity tracking
- Quick action recommendations
- Navigation state management

Key functions:
- `getTemplates()`: Retrieve session templates for dashboard display
- `getRecentActivities()`: Get recent swimmer runs or activities
- `getQuickActions()`: Generate personalized quick action suggestions

### Context Integration
- **Global Design**: Provides quick access to all management screens
- **Unified Model**: Consistent card-based navigation across screens
- **Integration**: Links to session creation, swimmer management, and drill library