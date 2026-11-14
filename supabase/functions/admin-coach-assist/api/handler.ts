// The admin coach-assist handler: transport/auth concerns only. Every side
// effect is injected via HandlerDeps, so the request lifecycle is unit-testable
// with fakes (see api/handler_test.ts).
//
// Task 1 owns the owner-only gate on GET /status. The route table is additive:
// later tasks append more routes to this same handler.

import { json } from './http.ts'
import type { HandlerDeps, ServiceRoleClient } from './deps.ts'
import type { SessionDraftV1 } from '../shared/sessionDraft/types.ts'
import {
  listCoaches,
  resolveCoachOrg,
  createRow,
  updateRow,
  deleteRow,
  getCoachData,
  materializeDraft,
  createSessionBundle,
  importSessionPackage,
  CoachResolutionError,
} from '../service/adminService.ts'
import { ScopedWriteError } from '../model/validate.ts'
import type { ScopedTable } from '../model/types.ts'

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    // The Edge runtime presents `req.url` as `/<slug>` when invoked at the function
    // mount (the `/functions/v1/` prefix is stripped before the handler runs), or
    // `/<slug>/<route>` for a direct URL-path call. `supabase.functions.invoke`
    // POSTs to the mount with the real route in the JSON body's `path` field (or a
    // `?path=` query). So the mount pathname is the function root — "route comes
    // from the body"; a non-empty remainder (e.g. `/<slug>/coaches`) is a direct
    // URL-path route, and the existing route table applies with the HTTP method as
    // part of the contract. The body is read once here and threaded into the
    // handlers, since a Request body stream can only be consumed a single time.
    const subpath = stripFunctionPrefix(url.pathname)
    const body = await readJsonBody<Record<string, unknown>>(req)
    const fromBody = subpath === '' || url.pathname === '/' || url.pathname === ''
    const routePath = fromBody ? resolveRoutePath(url, body) : subpath

    // With URL-path routing the HTTP method is part of the contract (existing
    // tests rely on it). When routed via body/query path the client cannot set a
    // URL path, so the method is intentionally ignored and routing is by path.
    const allow = (expected: string) => fromBody || req.method === expected

    // Additive route table — later tasks register more routes here.
    if (allow('GET') && routePath === '/status') {
      return handleStatus(deps, req)
    }

    // Owner-gated routes (Task 2+). The gate is enforced before any work is
    // done, so non-owners are rejected with 403 on these routes too.
    if (allow('GET') && routePath === '/coaches') {
      return withOwner(deps, req, () => handleListCoaches(deps))
    }

    // Owner-gated coach-data + scoped write routes (Task 4). The coach's org is
    // always resolved server-side via resolveCoachOrg; a client may never supply
    // a foreign org for a mutation.
    const coachDataMatch = routePath.match(/^\/coaches\/([^/]+)\/data$/)
    if (allow('GET') && coachDataMatch) {
      return withOwner(deps, req, () => handleCoachData(deps, coachDataMatch[1]))
    }

    const coachDraftMatch = routePath.match(/^\/coaches\/([^/]+)\/draft$/)
    if (allow('POST') && coachDraftMatch) {
      return withOwner(deps, req, () => handleCoachDraft(deps, body, coachDraftMatch[1]))
    }

    const sessionBundleMatch = routePath.match(/^\/coaches\/([^/]+)\/session-bundle$/)
    if (allow('POST') && sessionBundleMatch) {
      return withOwner(deps, req, () => handleSessionBundle(deps, body, sessionBundleMatch[1]))
    }

    const sessionImportMatch = routePath.match(/^\/coaches\/([^/]+)\/import-session$/)
    if (allow('POST') && sessionImportMatch) {
      return withOwner(deps, req, () => handleSessionPackageImport(deps, body, sessionImportMatch[1]))
    }

    const coachMatch = routePath.match(/^\/coaches\/([^/]+)$/)
    if (allow('GET') && coachMatch) {
      return withOwner(deps, req, () => handleCoachOrg(deps, coachMatch[1]))
    }

    if (allow('POST') && routePath === '/row') {
      return withOwner(deps, req, () => handleCreateRow(deps, body))
    }

    const rowIdMatch = routePath.match(/^\/row\/([^/]+)$/)
    // PATCH and DELETE share the `/row/:id` path; when routed via the body the
    // HTTP method is still carried by the request, so disambiguate on it rather
    // than on `allow()` (which ignores the method for body-routed calls and
    // would otherwise collapse DELETE into PATCH).
    if (req.method === 'PATCH' && rowIdMatch) {
      return withOwner(deps, req, () => handleUpdateRow(deps, body, rowIdMatch[1]))
    }
    if (req.method === 'DELETE' && rowIdMatch) {
      return withOwner(deps, req, () => handleDeleteRow(deps, body, rowIdMatch[1]))
    }

    return json({ error: 'not_found' }, 404)
  }
}

// Resolve the route path from a body `path` field or a `?path=` query, falling
// back to empty (→ 404) when neither is present. URL-path routing takes priority
// and is handled by the caller before this is reached.
function resolveRoutePath(url: URL, body: Record<string, unknown> | null): string {
  const fromQuery = url.searchParams.get('path')
  if (fromQuery) return fromQuery
  if (body && typeof body.path === 'string') return body.path
  return ''
}

// Strip the Supabase function mount prefix (`/functions/v1/<slug>`), returning the
// remainder — '' for the function root, or e.g. '/coaches' for a direct sub-path
// call. Paths without the prefix (unit-test URLs such as `/status`) are returned
// This handler is deployed once under a fixed name; the runtime hands the handler
// a pathname of `/<slug>` at the function root, or `/<slug>/<route>` for a direct
// URL-path call. Strip that mount prefix so the remainder is the intended route —
// '' means "route comes from the body" (the invoke contract). Other paths (e.g.
// unit-test URLs such as `/status`) are returned unchanged so URL-path routing keeps
// working in tests.
const FUNCTION_SLUG = 'admin-coach-assist'

function stripFunctionPrefix(pathname: string): string {
  const m = pathname.match(
    new RegExp(`^/functions/v1/${FUNCTION_SLUG}(/.*)?$|^/${FUNCTION_SLUG}(/.*)?$`),
  )
  if (!m) return pathname
  return m[1] ?? m[2] ?? ''
}

// Run the owner gate, then the action on success; a missing/unverifiable token
// (null) or a non-owner id yields 403.
async function withOwner(
  deps: HandlerDeps,
  req: Request,
  action: () => Promise<Response>,
): Promise<Response> {
  const callerUid = await deps.getCallerUid(req)
  if (callerUid === null || !deps.isOwner(callerUid)) {
    return json({ error: 'forbidden' }, 403)
  }
  return action()
}

async function handleStatus(deps: HandlerDeps, req: Request): Promise<Response> {
  // The owner gate is identical to every other route; reuse withOwner so the
  // 403 rule lives in exactly one place.
  return withOwner(deps, req, async () => json({ isOwner: true }, 200))
}

async function handleListCoaches(deps: HandlerDeps): Promise<Response> {
  const client = deps.createServiceRoleClient()
  const coaches = await listCoaches(client)
  return json({ coaches }, 200)
}

async function handleCoachOrg(deps: HandlerDeps, coachId: string): Promise<Response> {
  const client = deps.createServiceRoleClient()
  try {
    const orgId = await resolveCoachOrg(client, coachId)
    return json({ orgId }, 200)
  } catch (err) {
    if (err instanceof CoachResolutionError) {
      return json({ error: 'not_found' }, 404)
    }
    throw err
  }
}

// Parse a JSON request body, returning null when it is absent or malformed so
// the caller can respond with a 400 rather than an unhandled throw.
async function readJsonBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

// Resolve a coach's org (404 when none) and run the action with both the client
// and the resolved org id — keeping the "never a client-supplied org" invariant
// in one place for every coach-scoped route.
async function withCoachScope(
  deps: HandlerDeps,
  coachUserId: string,
  action: (client: ServiceRoleClient, orgId: string) => Promise<Response>,
): Promise<Response> {
  const client = deps.createServiceRoleClient()
  try {
    const orgId = await resolveCoachOrg(client, coachUserId)
    return await action(client, orgId)
  } catch (err) {
    if (err instanceof CoachResolutionError) {
      return json({ error: 'not_found' }, 404)
    }
    throw err
  }
}

async function handleCreateRow(
  deps: HandlerDeps,
  body: Record<string, unknown> | null,
): Promise<Response> {
  if (!body || !body.coachUserId || !body.table || !body.payload) {
    return json({ error: 'bad_request' }, 400)
  }
  const coachUserId = body.coachUserId as string
  const table = body.table as ScopedTable
  const payload = body.payload as Record<string, unknown>
  try {
    return await withCoachScope(deps, coachUserId, async (client, orgId) => {
      const { id } = await createRow(client, orgId, table, payload, coachUserId)
      return json({ id }, 200)
    })
  } catch (err) {
    if (err instanceof ScopedWriteError) return json({ error: 'bad_request' }, 400)
    throw err
  }
}

async function handleUpdateRow(
  deps: HandlerDeps,
  body: Record<string, unknown> | null,
  id: string,
): Promise<Response> {
  if (!body || !body.coachUserId || !body.table || !body.patch) {
    return json({ error: 'bad_request' }, 400)
  }
  const coachUserId = body.coachUserId as string
  const table = body.table as ScopedTable
  const patch = body.patch as Record<string, unknown>
  try {
    return await withCoachScope(deps, coachUserId, async (client, orgId) => {
      await updateRow(client, orgId, table, id, patch, coachUserId)
      return json({ ok: true }, 200)
    })
  } catch (err) {
    if (err instanceof ScopedWriteError) return json({ error: 'bad_request' }, 400)
    throw err
  }
}

async function handleDeleteRow(
  deps: HandlerDeps,
  body: Record<string, unknown> | null,
  id: string,
): Promise<Response> {
  if (!body || !body.coachUserId || !body.table) {
    return json({ error: 'bad_request' }, 400)
  }
  const coachUserId = body.coachUserId as string
  const table = body.table as ScopedTable
  try {
    return await withCoachScope(deps, coachUserId, async (client, orgId) => {
      await deleteRow(client, orgId, table, id)
      return json({ ok: true }, 200)
    })
  } catch (err) {
    if (err instanceof ScopedWriteError) return json({ error: 'bad_request' }, 400)
    throw err
  }
}

async function handleCoachData(
  deps: HandlerDeps,
  coachId: string,
): Promise<Response> {
  return withCoachScope(deps, coachId, async (client, orgId) => {
    const data = await getCoachData(client, orgId)
    return json(data, 200)
  })
}

async function handleCoachDraft(
  deps: HandlerDeps,
  body: Record<string, unknown> | null,
  coachId: string,
): Promise<Response> {
  const draft = body?.draft as SessionDraftV1 | undefined
  if (!body || !draft) {
    return json({ error: 'bad_request' }, 400)
  }
  return withCoachScope(deps, coachId, async (client, orgId) => {
    const result = await materializeDraft(client, orgId, coachId, body.draft as SessionDraftV1)
    return json(result, 200)
  })
}

async function handleSessionBundle(
  deps: HandlerDeps,
  body: Record<string, unknown> | null,
  coachId: string,
): Promise<Response> {
  if (
    !body
    || !body.session
    || !Array.isArray(body.drills)
    || (body.rejectNameConflict !== undefined && typeof body.rejectNameConflict !== 'boolean')
  ) {
    return json({ error: 'bad_request' }, 400)
  }

  try {
    return await withCoachScope(deps, coachId, async (client, orgId) => {
      const result = await createSessionBundle(
        client,
        orgId,
        coachId,
        body.session as Record<string, unknown>,
        body.drills as Array<Record<string, unknown>>,
        body.rejectNameConflict === true,
      )
      return json(result, 200)
    })
  } catch (err) {
    if (err instanceof ScopedWriteError) return json({ error: 'bad_request' }, 400)
    throw err
  }
}

async function handleSessionPackageImport(
  deps: HandlerDeps,
  body: Record<string, unknown> | null,
  coachId: string,
): Promise<Response> {
  if (!body || !('package' in body) || typeof body.name !== 'string') {
    return json({ error: 'bad_request' }, 400)
  }

  try {
    return await withCoachScope(deps, coachId, async (client, orgId) => {
      const result = await importSessionPackage(client, orgId, coachId, body.package, body.name as string)
      return json(result, 200)
    })
  } catch (err) {
    if (err instanceof ScopedWriteError) return json({ error: 'bad_request' }, 400)
    throw err
  }
}
