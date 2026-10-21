# Session Share-Link Design (High Level)

## Purpose

This describes the later, server-backed delivery path for the portable session
package in [`Import-Export-Context.md`](./Import-Export-Context.md). It is not
live collaboration. The sharer publishes a **snapshot** of one session template;
anyone with the link may retrieve that package and explicitly import a new copy
into their own PWA.

The share link is a convenience over the manual file flow. Both deliver the
same versioned `.swimsheet` package and use the same client importer.

## Product behavior

1. A signed-in sharer selects **Create share link** for one session.
2. The app ensures the current session and drills are synced to the sharer's
   account. If sync fails, publication fails rather than sharing stale backend
   content.
3. The backend verifies the sharer may share that session and stores an
   immutable, validated package snapshot in a private share record.
4. The app returns a high-entropy bearer link for the sharer to send by email,
   WhatsApp, or another channel.
5. Anyone with the link can open a share preview without signing in. The preview
   offers **Add to my sessions** and may also offer **Download .swimsheet**.
6. **Add to my sessions** runs the same validation, name-conflict, and atomic
   import flow as file import. A signed-out recipient gets a local copy; a
   signed-in recipient gets a local copy that normal account sync can push to
   their own account and devices.
7. The sharer can see active links, their expiry, and revoke them. A later share
   of an edited template creates a new snapshot; it never silently changes an
   existing link's content.

This is copy distribution. The recipient owns and may edit their copy. The
source and recipient do not remain linked.

## Share storage and access model

The backend stores the **actual package snapshot**, not a foreign-key-only
reference to `sessions`/`drills`. Therefore source edits or deletion do not
change or break an already-published share. The share record should contain at
least:

- Share ID and owner profile ID (and source organization/session IDs for audit;
  source references must not cascade-delete the snapshot).
- The validated portable package JSON.
- A hash of the bearer token, never the raw token.
- Created, expires, and revoked timestamps.

Keep the table in a non-public/private schema and do not grant browser roles
(`anon` or `authenticated`) direct table access. The token is a capability: treat
it as a secret, make it unguessable, avoid logging it, and do not send it to
analytics. The PWA share page resolves it through a controlled backend endpoint
(e.g. an Edge Function using service-role access) that returns only the package
when the share exists, has not expired, and has not been revoked. This preserves
the project's rule against public/anon-executable `SECURITY DEFINER` RPCs that
could bypass RLS.

Share creation is authenticated and owner-authorized. The backend reads the
synced source session and its drills under an owner-checked path, maps only the
portable package allowlist, validates it, then stores the snapshot. It must not
include swimmers, runs, or results. A share record is not a row in the client's
sync tables and is never pulled into a recipient's local database.

## Owner control and revocation limits

The owner may revoke a share or let it expire. That prevents **future** link
resolutions/downloads. It cannot recall a package already downloaded, copied,
or imported by a recipient. The UI and any confirmation copy must state this
clearly; a server-hosted link cannot provide DRM or remote deletion of a
recipient's data.

Expiry policy, allowed expiry choices, and whether to expose a download counter
are product settings to settle during implementation. If counters are added,
record only what is needed; anonymous bearer-link use cannot reliably identify a
person.

## Sync relationship

- The source must be synced before link creation so the backend snapshots the
  version the sharer sees. This uses current session/drill cloud rows and does
  not widen their RLS to other users.
- The share snapshot is separate from regular account sync. It does not add a
  table to `SupabaseSyncTransport` or change sync cursors.
- A recipient imports a new session with fresh IDs. If signed in, that copy then
  follows existing recipient-account sync; it does not enter the sharer's
  organization or account.
- Link delivery supports cases 1–3 (anonymous file exchange, independent
  accounts, and intentional copy sharing). It does not by itself implement
  shared-organization collaboration.

## Relationship to future collaboration

A snapshot share table is useful for controlled distribution and could support a
future **copy into a shared workspace** flow. It is not the authorization model
for ongoing collaboration. Live shared templates require a canonical shared
record plus membership/permissions and an org-aware client sync flow; the
current client sync resolves a personal organization and does not yet provide
that collaboration flow. A future collaboration epic should keep the immutable
share publication separate from grants to edit or access live shared content.

Sharing results is explicitly separate: the package and link contain no
swimmers, `SessionRun`, timing, or results data.

## Security and verification requirements for the future implementation

- Test that only an authorized signed-in owner can create a share for a session
  they can manage.
- Test that unknown, expired, and revoked tokens return no package, and active
  tokens return only the validated session package.
- Test that `anon`/`authenticated` cannot directly select or mutate private
  share rows; verify grants and schema exposure against local and hosted.
- Test token generation/hash validation, expiry/revocation, rate limits, and
  that raw tokens and package contents are excluded from logs/analytics.
- Test the recipient preview/import for both signed-out and signed-in clients,
  including sync to the recipient's own account and no writes to the sharer's
  organization.
- Keep package validation and size bounds in the shared session-package
  contract/config; the backend must validate independently of client UI.
