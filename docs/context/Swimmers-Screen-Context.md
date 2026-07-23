# SwimSheet Swimmers Screen Context

## Screen: SwimmersList & SwimmerDetail

### Purpose
Primary management interface for swimmer roster. Allows coaches to add, edit, and view swimmer profiles. Provides search, filtering, and detailed view of individual swimmers with full CRUD capabilities.

### UI Components
- **SwimmersList** (`client/src/pages/SwimmersList.tsx`)
  - Hero with "Add Swimmer" button
  - Search bar with real-time filtering
  - Grid of swimmer cards with quick actions (edit, delete)
  - Pagination and scroll handling for large rosters

- **SwimmerDetail** (`client/src/pages/SwimmerDetail.tsx`)
  - Complete swimmer profile view
  - Edit form modal trigger
  - Session/run history for this swimmer
  - Delete confirmation modal

- **SwimmerFormModal** (`client/src/components/SwimmerFormModal.tsx`)
  - Full swimmer creation/edit form
  - Fields: name, age group, strokes (list), equipment (tags), notes
  - Form validation and error handling
  - Cancel/save actions

### User Flow
1. Navigate to SwimmersList from Dashboard
2. Use search to find specific swimmer
3. Add new swimmer: Click "Add Swimmer" → Fill form → Save
4. Edit swimmer: Click swimmer card → Click edit button → Modify fields → Save
5. Delete swimmer: Click swimmer card → Click delete → Confirm → Data retained in history
6. View details: Click swimmer card → See full profile and history

### API Layer (Swimmers API)
**File**: `client/src/api/swimmers.ts`

Functions:
- `listSwimmers()`: Get all swimmers
- `searchSwimmers(query)`: Search by name or other fields
- `getSwimmer(id)`: Get single swimmer details
- `createSwimmer(data)`: Create new swimmer (SafeSwimmer type)
- `updateSwimmer(id, data)`: Update swimmer profile (Partial<SafeSwimmer>)
- `deleteSwimmer(id)`: Delete swimmer
- `deleteSwimmerWithData(id)`: Export data before delete
- `exportSwimmerData(id)`: Download swimmer data as Blob

**REST-like structure** (API facade over Service):
```
GET    /swimmers           listSwimmers()
GET    /swimmers/:id       getSwimmer(id)
POST   /swimmers          createSwimmer(data)
PUT    /swimmers/:id      updateSwimmer(id, data)
DELETE /swimmers/:id      deleteSwimmer(id)
```

### Service Layer
**File**: `client/src/services/swimmerService.ts`

Responsibilities:
- Business logic for swimmer CRUD operations
- Search algorithm for filtering swimmers
- Data export/import logic
- Integration with run tracking

Key functions:
- `list()`: Retrieve all swimmers
- `get(id)`: Get single swimmer
- `create(data)`: Create new swimmer record
- `update(id, data)`: Update swimmer
- `delete(id)`: Soft delete swimmer
- `deleteWithData(id)`: Export data then delete
- `exportData(id)`: Generate data Blob for download
- `search(query)`: Filter swimmers by name or other criteria

### Data Structure
**File**: `client/src/db/schema.ts`

Types:
- `Swimmer`: Full swimmer record
  - `id` (string): Unique identifier
  - `name` (string): Swimmer name
  - `ageGroup` (string, optional): Age classification
  - `strokes` (string[]): Array of stroke types (freestyle, backstroke, breaststroke, butterfly)
  - `equipment` (string[]): Array of equipment tags (goggles, fins, pull buoy, etc.)
  - `notes` (string, optional): Notes or comments
  - `createdAt` (number): Unix timestamp
  - `updatedAt` (number): Unix timestamp

- `SafeSwimmer`: Editable swimmer record (same as Swimmer without internal fields)

### Context Integration
- **Global Design**: Aligns with fast-path value: adding swimmers is the first step in setup
- **Unified Model**: Follows same list/detail/create pattern as Sessions and Drills
- **Integration**: Swimmers added to sessions appear in live view as participants
- **Persistence**: All CRUD works offline; changes sync on connection restore