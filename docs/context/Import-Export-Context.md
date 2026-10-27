# Session Package Import/Export Design

## Status and scope

This is the detailed design and implementation contract for **Step 1:
portable session-template files**. The file-based import/export foundation is
implemented; server-backed share links remain a later phase described in
[`Session-Sharing-Design.md`](./Session-Sharing-Design.md).

A coach exports one session template to a JSON `.swimsheet` file and sends it
through email, WhatsApp, AirDrop, or another channel. The recipient imports it
as a new session in their own PWA. The same versioned package is the payload for
the later server-backed share-link flow described in
[`Session-Sharing-Design.md`](./Session-Sharing-Design.md).

In scope:
- One session template and its ordered drills, including rich drill items.
- Importing into a signed-out/local PWA or a signed-in PWA.
- Explicit name-conflict handling, validation, and atomic creation.
- A portable package contract that can also be stored by a later share-link
  service.

Out of scope:
- Whole-database backup/restore (already separate in Settings).
- Swimmers, active/completed runs, lap/timing results, or organization membership.
- Drill-bank import, global drill deduplication, or “Make Native”. Session drills
  remain embedded in the imported session; importing must not change the
  recipient's drill bank.
- Live collaboration, updates flowing back to the author, or result sharing.

## Product model

Import/export is a **copy** operation, not shared access to the author's record.
The export is a self-contained snapshot. Import creates a new session and new
local IDs; editing or deleting either copy has no effect on the other.

The same behavior serves these cases:

| Case | Flow | Result |
|---|---|---|
| Two signed-out PWAs | Send `.swimsheet` file manually | Recipient gets a local copy; no backend required. |
| Two logged-in users with separate accounts | Send/import the same file | Recipient gets a copy in their account; normal sync sends it to their other devices. The accounts remain isolated. |
| One user deliberately shares a copy | Same package, with a share-link delivery flow later | Recipient explicitly imports a new copy. This is a UX/delivery distinction, not a different session data model. |

The file path must continue to work offline and without authentication. A
logged-in recipient's import follows existing sync behavior; a file import does
not itself grant access to the sharer's cloud data.

## Portable package format

### Envelope

The v1 file is UTF-8 JSON with extension `.swimsheet` and MIME type
`application/json`:

```json
{
  "format": "swimsheet-session",
  "version": 1,
  "exportedAt": "2026-10-21T12:00:00.000Z",
  "creator": {
    "label": "Optional coach or club label"
  },
  "session": {
    "name": "200m IM Day",
    "notes": "Focus on transitions and underwaters"
  },
  "drills": [
    {
      "name": "IM Order Practice",
      "stroke": "im",
      "distance": 200,
      "order": 0,
      "items": [
        { "distance": 50, "stroke": "butterfly", "repeatCount": 1 },
        { "distance": 50, "stroke": "backstroke", "repeatCount": 1 },
        { "distance": 50, "stroke": "breaststroke", "repeatCount": 1 },
        { "distance": 50, "stroke": "freestyle", "repeatCount": 1 }
      ],
      "repeatCount": 1,
      "timingMode": "individual",
      "focus": "fitness",
      "labels": ["aerobic"],
      "description": "Swim 50m of each stroke in IM order."
    }
  ]
}
```

`drills` may be empty: the app allows empty template shells and export/import
must preserve them. A drill's `items` may also be empty if the source record is
empty; the package is a transport format, not a repair operation.

`creator.label` is optional, display-only metadata supplied by the exporter. It
is untrusted input and must never be used for authorization. Do not export an
auth user ID, email address, organization ID, or raw database ownership fields.
The package has no stable publisher fingerprint in v1; imported files are not
silently treated as updates from a known author.

### Included content

- Session: `name`, `notes`.
- Drill: `name`, `stroke`, `distance`, `order`, `items`, `repeatCount`,
  `timingMode`, `focus`, `labels`, `description`.
- Drill item: `distance`, `stroke`, `repeatCount`, and supported optional fields
  such as `intensity`, `interval`, `equipment`, and `segments`.

The package requires top-level drill `stroke` and `distance`. Some manually
authored local drills may have those summary fields absent while their items
contain the authored structure. Export preserves a present summary value; when
it is absent, it derives stroke from the first item and distance with the
existing `getDrillTotalDistance` rule. If no stroke can be derived, export
fails with a recoverable error instead of inventing one.

The package deliberately omits all database IDs, `sessionId`, `libraryDrillId`,
`assignedTo`, `visibility`, `catalogKey`, AI draft state, timestamps used for
local persistence, and all run/history data. IDs inside `DrillItem` are also
omitted and regenerated on import. Unknown future authored fields require an
explicit package-contract update; the importer must not silently discard them.

`poolLength` is not included in v1: the client `Session` model does not currently
carry it, even though a cloud column exists. The package must not invent a value
from a device-wide setting. If pool length becomes an authored session field,
add it deliberately to the package contract and import/export tests.

### Contract ownership and validation

The portable DTO, version-specific validator, and tunable size/count limits
belong in a runtime-agnostic `shared/sessionPackage/` module, following the
existing shared-contract pattern. Both the PWA and future share endpoint use the
same validator/config; there must not be separate client and server copies of
the package rules.

Validation is strict and allowlist-based:
- Check format and supported version before mapping to app types.
- Validate every string, enum, number, nested item, segment, and array shape.
- Reject unknown fields for v1 rather than silently losing authored content.
- Enforce maximum file size and collection/string bounds from a dedicated config
  module, not inline numeric limits.
- Treat creator text, filenames, and every imported value as untrusted.

The v1 default limits are: file 1 MiB; session/drill/segment/creator name 100
characters; session notes 4,000 characters; drill description 400 characters;
interval/intensity 40 characters; labels 20 per drill and 64 characters each;
drills 100 per session; items 100 per drill; equipment 16 values per item and
64 characters each; segments 100 per item; distance 10,000m; repeat count 100.
Distances may be zero; repeat counts must be positive integers; drill order must
be a nonnegative safe integer. Equipment remains a bounded string rather than
an enum so user-configured equipment survives transfer. Intensity and interval
are bounded strings as in the current authoring model; interval syntax is not
reinterpreted by the importer. These defaults live only in the shared package
config and can be deliberately changed there.

Malformed, unsupported, or oversized files fail before writing anything and
show a recoverable message. Do not partially import a session.

## Export flow

1. From a session card or editor, choose **Export session**.
2. Read the session and its ordered drills through the API/service layers.
3. Map only the package allowlist; omit database/ownership fields and all run
   data; validate the package before serialization.
4. Serialize as UTF-8 JSON and enforce the configured 1 MiB file-size cap on the
   generated bytes. If the export exceeds it, do not start a download; show a
   recoverable message.
5. Download `<session-name-slug>.swimsheet` using the browser's file-download
   mechanism. The app does not require an account or a network connection.
6. The coach shares the file through their preferred channel.

If a session cannot be read or fails package validation, do not produce a
partial or misleading file; show an error and leave the source unchanged.

## Import flow

1. Choose **Import session**, then select a `.swimsheet` file. The parser should
   accept valid JSON content regardless of the extension, but the picker should
   guide users toward `.swimsheet` files.
2. Enforce the configured byte limit before parsing. Parse JSON and run the
   shared versioned validator.
3. Show a preview with session name, drill count, total distance when derivable,
   and optional creator label. Do not persist before confirmation.
4. Check for a session-name collision using trimmed, case-insensitive names. If
   one exists, offer **Import as a copy**
   (with a suggested distinct name: `<name> (imported)`, adding a numbered
   suffix if needed) or **Cancel**. Never overwrite or merge an existing
   session. V1 does not promise re-import-as-update; repeated imports go through
   the same conflict choice.
5. On confirmation, create a new session and all drills in one Dexie transaction.
   Generate fresh IDs and timestamps for the session, drills, and nested drill
   items; assign new `sessionId` values and preserve drill order and authored
   fields.
6. Show success and a **View session** action.

Use the DAO's conditional session-and-drills writer: it evaluates the service's
name-conflict predicate and inserts the session plus drills inside the same
Dexie read-write transaction. This prevents concurrent imports from both
passing a stale preflight check. Do **not** route imported drills through `addDrill`:
that method also writes to the drill bank, where current name-based upsert can
collide with a recipient's native/builtin entry. Import creates only the session
and its embedded drills. A later promotion-to-library feature is separate.

The receiving session is an ordinary editable template. The importer does not
create `SessionRun`, `RunDrill`, swimmers, laps, or timing data.

## Sync and ownership behavior

- Signed-out import writes only to the local Dexie database and works offline.
- Signed-in import creates recipient-owned local rows. Existing sync pushes the
  session before its drills into the recipient's own organization; the sharer's
  organization and rows are never read by the recipient's sync process.
- Provenance shown from `creator.label` may be retained as import metadata only
  if it is intentionally modeled and synced. It is not required for v1 copy
  semantics and must not be claimed to sync until cloud columns and
  `SupabaseSyncTransport` mappings support it.
- Do not use Settings' whole-database JSON backup as a session-sharing file.
  Backup/restore is a different format and can replace local data, while a
  `.swimsheet` import is a validated additive copy of one template.

## Service boundaries

- `shared/sessionPackage/`: package types, version config, limits, pure validator
  and mapping helpers shared with the future backend endpoint.
- Client UI: file picker/download, preview, duplicate-name choice, and messages.
- Client API/service: export a validated package; validate and import a package.
- DAO: pure reads plus atomic session-and-drills creation. The service supplies
  the name-conflict predicate; the DAO owns only the Dexie transaction. No
  library side effects.
- Future share delivery: retrieves the same package format and calls the same
  import service as file import.

Pages and components must not import `db/` directly.

## Acceptance criteria

- A signed-out PWA can export a session and import the file in another signed-out
  PWA without a server request.
- A logged-in recipient can import a file into their own account; after sync,
  the session and its drills appear on their other device, not in the sender's
  account.
- Rich drill items, order, optional fields, and segments round-trip without loss.
- Imported session/drill/item IDs are fresh; no run, swimmer, or result data is
  copied; the drill bank is unchanged.
- Invalid, unsupported, unknown-field, and over-limit files produce no partial
  writes.
- Name conflicts never overwrite existing content and are resolved explicitly.
- Export/import does not require auth and does not depend on server availability.

## Test design

- Shared contract unit tests for valid v1 packages, each invalid field/enum,
  unknown keys, malformed nested structures, and configured bounds.
- Service/DAO tests for round-trip mapping, fresh IDs, drill order and rich item
  preservation, atomic rollback, no library writes, and collision behavior.
- UI tests for file selection/download, preview, conflict choice, cancel, errors,
  and success navigation.
- E2E: export in one browser context, transfer the file to another PWA context,
  import, edit/run the copy, and verify the original remains unchanged. Add a
  signed-in sync E2E for recipient-account propagation when the auth test setup
  is available.
