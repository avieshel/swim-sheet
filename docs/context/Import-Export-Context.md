# Import/Export Context

## Overview

File-based session template sharing for cross-coach distribution. Not for same-coach multi-device (that's what the server sync engine is for). Used for:

1. **Onboarding** — a coach trying the app receives a session file from the app creator, imports it, and immediately has a real session to run
2. **Peer sharing** — coaches exchange sessions with each other via email/AirDrop/messaging
3. **Curated defaults** — the app creator maintains a collection of seed session files for different workout types

## Design Principle

Imported content is **namespaced** — it lives in its own section of the drill bank, tagged with the creator's identity. It never merges with the coach's "native" drill library unless the coach explicitly promotes individual drills via "Make Native."

This avoids the dedup problem: two coaches call the same drill different things, so name-based dedup is unreliable. Namespacing keeps each coach's native library pristine.

## Data Model

### LibraryDrill additions

```ts
interface LibraryDrill {
  // ... existing fields
  source: 'builtin' | 'personal' | 'customized' | 'imported'
  creatorFingerprint?: string   // stable UUID of the exporting coach
  creatorLabel?: string         // human-readable label ("Sarah's Swim Club")
  importBatchId?: string        // groups drills from the same import file
}
```

### Session additions

```ts
interface Session {
  // ... existing fields
  source?: 'native' | 'imported'
  creatorFingerprint?: string
  importBatchId?: string
}
```

### Creator Fingerprint

- Generated on first export — a stable UUID persisted in `localStorage` (via `DbMeta` table key `creatorFingerprint`)
- Coach can optionally set a human-readable label ("Sarah's Swim Club") that appears in the import UI
- The fingerprint is the identity anchor for re-import updates; the label is just display
- Written into every exported file so imports are traceable to the source

## Export Format

### File format version: `swimsheet-session-v1`

```json
{
  "format": "swimsheet-session-v1",
  "exportedAt": "2026-07-30T12:00:00.000Z",
  "creator": {
    "fingerprint": "a1b2c3d4-e5f6-...",
    "label": "Sarah's Swim Club"
  },
  "session": {
    "name": "200m IM Day",
    "poolLength": 25,
    "notes": "Focus on transitions and underwaters"
  },
  "drills": [
    {
      "name": "IM Order Practice",
      "stroke": "im",
      "distance": 200,
      "order": 1,
      "items": [
        {
          "id": "item-uuid-1",
          "distance": 50,
          "stroke": "butterfly",
          "repeatCount": 1
        },
        {
          "id": "item-uuid-2",
          "distance": 50,
          "stroke": "backstroke",
          "repeatCount": 1
        },
        {
          "id": "item-uuid-3",
          "distance": 50,
          "stroke": "breaststroke",
          "repeatCount": 1
        },
        {
          "id": "item-uuid-4",
          "distance": 50,
          "stroke": "freestyle",
          "repeatCount": 1
        }
      ],
      "repeatCount": 1,
      "timingMode": "individual",
      "focus": "fitness",
      "labels": ["anaerobic", "aerobic", "rhythm"],
      "description": "50m of each stroke in IM order (Fly, Back, Breast, Free). Focus on stroke transitions."
    }
  ]
}
```

No `id` fields for entities — they are regenerated on import. The `session.name` and drill `name` values are the identity anchors for re-import matching.

### File extension and MIME type
- Extension: `.swimsheet`
- MIME type: `application/json` (served with `Content-Disposition: attachment; filename="..."`)

## Import Flow

### Phase 1: Basic import (no de duplication)

```
User taps "Import Session" → file picker → selects .swimsheet file
  ↓
Parse + validate format === 'swimsheet-session-v1'
  ↓
Check: session name already exists in db.sessions?
  │
  ├─ No → create session, add drills
  │
  └─ Yes → show conflict dialog:
           [Create as Copy] → append " (imported YYYY-MM-DD)" to name
           [Skip]            → abort import
  ↓
For each drill in file:
  Call addLibraryDrill({
    ...drill,
    source: 'imported',
    creatorFingerprint: file.creator.fingerprint,
    creatorLabel: file.creator.label,
    importBatchId: batchId,
  })
  → addLibraryDrill upserts by (name + creatorFingerprint)
    → If same name from same creator exists → updates existing import record
    → If same name from different creator → creates separate import record
    → This prevents duplicates within the same import source
  ↓
Call addDrill({ ...drill, session_id: newSessionId })
  → addDrill internally calls addLibraryDrill (upserts again — idempotent)
  ↓
Show import summary:
  "Imported '200m IM Day' — 6 drills (2 already in your library from Sarah's Swim Club)"
```

### Import result dialog

```
┌──────────────────────────────────┐
│ Import Complete                   │
│                                   │
│ Session: 200m IM Day             │
│ Drills imported: 6               │
│ Already in library: 2            │
│ (from Sarah's Swim Club)         │
│                                   │
│ [View in Sessions] [View Imports] │
└──────────────────────────────────┘
```

### Key dedup rules (within import namespace)

| Scenario | Behavior |
|---|---|
| Same drill name, same creator, same batch | `addLibraryDrill` upserts — no duplicate |
| Same drill name, same creator, different batch | `addLibraryDrill` upserts by (name + creator) — updates existing, no duplicate |
| Same drill name, different creator | Creates separate entry with different `creatorFingerprint` — allowed |
| Same session name, any creator | Conflict dialog — user chooses Create as Copy or Skip |
| Re-import same file twice | All drills match by (name + creator), session skipped on second import |

## Export Flow

### From SessionsList

```
User taps export icon on session card
  ↓
Read session + drills from Dexie
  ↓
Get creator fingerprint from localStorage (generate if missing)
  ↓
Construct JSON payload (format: swimsheet-session-v1)
  ↓
Download as {session-name-slugified}.swimsheet
```

### Creator fingerprint management

- Stored in the `_meta` table (accessed as `db._meta`) under key `creatorFingerprint`
- Generated via `crypto.randomUUID()` on first export
- Coach can see/change their creator label in Settings
- Fingerprint never changes once generated (stable identity anchor)

## Drill Bank UI

```
┌─────────────────────────────────┐
│ Drill Bank                   [+]│
├─────────────────────────────────┤
│ [My Drills] [Imports ▼]         │ ← tab selector
├─────────────────────────────────┤
│ Imported from:                   │
│ Sarah's Swim Club                │ ← grouped by creatorLabel
│ ── Sprint Set              [×]  │
│ ── Descending Set          [×]  │
│ ── 200 IM                  [×]  │
│                                 │
│ Imported from:                   │
│ Coach Mike                       │
│ ── Distance Day            [×]  │
├─────────────────────────────────┤
│ [+ Import Session]              │
└─────────────────────────────────┘
```

- Tap `[×]` removes the drill from the import batch (soft-delete: flags as `source: 'archived'`)
- Import batches are collapsed by default
- Expanding a batch shows the individual drills
- Imported drills are not editable inline (read-only copy of the source)
- "Make Native" button per drill opens a matching UI against the native library

## "Make Native" Flow (Phase 2)

When a coach finds an imported drill they want in their permanent library:

1. Tap "Make Native" on an imported drill
2. App runs `findSimilarDrills()` against the native library
3. High match found (≥0.5) → "This looks like your '200 IM'. Replace with native version?"
   - [Use Native] — links session to native drill, hides import drill
   - [Keep Both] — copies import drill as `source: 'personal'`
   - [Cancel]
4. No match found → "Add 'Sprint Set' to your library?" → creates copy as `source: 'personal'`

## What This Doesn't Solve (Deliberately)

| Problem | Solution | Status |
|---|---|---|
| Same coach, phone ↔ tablet sync | Server sync engine (fix A-008, A-009) | Future work |
| Global drill dedup across all coaches | Not possible without AI — namespacing avoids the need | Out of scope |
| Central session marketplace / library | File-based sharing only — no server-side community | Out of scope |
| Imported drill editing (mid-session) | Coach edits the native version, not the import | By design |

## Implementation Notes

### `addLibraryDrill` must be updated

Current `addLibraryDrill` upserts by name alone. For imported drills, the upsert key must be `(name + creatorFingerprint)`:

```ts
// Updated upsert logic
if (data.source === 'imported' && data.creatorFingerprint) {
  existing = await db.libraryDrills
    .where({ name: data.name, creatorFingerprint: data.creatorFingerprint })
    .first()
} else {
  existing = await db.libraryDrills.where('name').equals(data.name).first()
}
```

### `addDrill` auto-save to library

The existing `addDrill` → `addLibraryDrill` chain (dao.ts:103-116) works fine for imported sessions — `addLibraryDrill` will upsert the imported drill (by name + creator), which is the correct behavior.

### Import does not create Run records

Imports only create `Session` + `Drill` records. The coach runs them as usual through `runService.createFromTemplate`. Imports are templates, not historical data.

### File structure

```
client/src/
├── api/
│   └── importExport.ts    # exportSession(), importSession(), generateCreatorFingerprint()
├── db/
│   └── schema.ts          # source, creatorFingerprint, importBatchId on LibraryDrill/Session
├── pages/
│   ├── SessionsList.tsx   # Export button, Import button, conflict dialog
│   └── DrillBank.tsx      # "My Drills" / "Imports" tab
└── utils/
    └── importHelpers.ts   # format validation, session name conflict handling
```
