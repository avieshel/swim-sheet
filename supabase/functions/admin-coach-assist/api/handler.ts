// The admin coach-assist handler: transport/auth concerns only. Every side
// effect is injected via HandlerDeps, so the request lifecycle is unit-testable
// with fakes (see api/handler_test.ts).
//
// Task 1 owns the owner-only gate on GET /status. The route table is additive:
// later tasks append more routes to this same handler.

import { json } from './http.ts'
import type { ServiceRoleClient } from './deps.ts'
import type { SessionDraftV1 } from '../shared/sessionDraft/types.ts'
import {
  listCoaches,
  resolveCoachOrg,
  createRow,
  updateRow,
  deleteRow,
  getCoachData,
  materializeDraft,
  CoachResolutionError,
} from '../service/adminService.ts'
import { ScopedWriteError } from '../model/validate.ts'
import type { ScopedTable } from '../model/types.ts'

export interface HandlerDeps {
  // Resolve the caller's authenticated user id from their JWT. null means the
  // token was absent, malformed, or unverifiable — treated as "not an owner".
  getCallerUid(req: Request): Promise<string | null>
  // Whether a user id is a configured owner.
  isOwner(uid: string): boolean
  // Service-role client factory (used by later tasks; injected, never built
  // inside the handler).
  createServiceRoleClient(): ServiceRoleClient
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url)

    // Additive route table — later tasks register more routes here.
    if (req.method === 'GET' && url.pathname === '/status') {
      return handleStatus(deps, req)
    }

    // Owner-gated routes (Task 2+). The gate is enforced before any work is
    // done, so non-owners are rejected with 403 on these routes too.
    if (req.method === 'GET' && url.pathname === '/coaches') {
      return withOwner(deps, req, () => handleListCoaches(deps))
    }

    // Owner-gated coach-data + scoped write routes (Task 4). The coach's org is
    // always resolved server-side via resolveCoachOrg; a client may never supply
    // a foreign org for a mutation.
    const coachDataMatch = url.pathname.match(/^\/coaches\/([^/]+)\/data$/)
    if (req.method === 'GET' && coachDataMatch) {
      return withOwner(deps, req, () => handleCoachData(deps, coachDataMatch[1]))
    }

    const coachDraftMatch = url.pathname.match(/^\/coaches\/([^/]+)\/draft$/)
    if (req.method === 'POST' && coachDraftMatch) {
      return withOwner(deps, req, () => handleCoachDraft(deps, req, coachDraftMatch[1]))
    }

    const coachMatch = url.pathname.match(/^\/coaches\/([^/]+)$/)
    if (req.method === 'GET' && coachMatch) {
      return withOwner(deps, req, () => handleCoachOrg(deps, coachMatch[1]))
    }

    if (req.method === 'POST' && url.pathname === '/row') {
      return withOwner(deps, req, () => handleCreateRow(deps, req))
    }

    const rowIdMatch = url.pathname.match(/^\/row\/([^/]+)$/)
    if (req.method === 'PATCH' && rowIdMatch) {
      return withOwner(deps, req, () => handleUpdateRow(deps, req, rowIdMatch[1]))
    }
    if (req.method === 'DELETE' && rowIdMatch) {
      return withOwner(deps, req, () => handleDeleteRow(deps, req, rowIdMatch[1]))
    }

    return json({ error: 'not_found' }, 404)
  }
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
  const callerUid = await deps.getCallerUid(req)
  // Owner gate: a missing/unverifiable token (null) or a non-owner id is 403.
  if (callerUid === null || !deps.isOwner(callerUid)) {
    return json({ error: 'forbidden' }, 403)
  }
  return json({ isOwner: true }, 200)
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

async function handleCreateRow(deps: HandlerDeps, req: Request): Promise<Response> {
  const body = await readJsonBody<{
    coachUserId?: string
    table?: string
    payload?: Record<string, unknown>
  }>(req)
  if (!body || !body.coachUserId || !body.table || !body.payload) {
    return json({ error: 'bad_request' }, 400)
  }
  try {
    return await withCoachScope(deps, body.coachUserId, async (client, orgId) => {
      const { id } = await createRow(
        client,
        orgId,
        body.table as ScopedTable,
        body.payload as Record<string, unknown>,
        body.coachUserId as string,
      )
      return json({ id }, 200)
    })
  } catch (err) {
    if (err instanceof ScopedWriteError) return json({ error: 'bad_request' }, 400)
    throw err
  }
}

async function handleUpdateRow(
  deps: HandlerDeps,
  req: Request,
  id: string,
): Promise<Response> {
  const body = await readJsonBody<{
    coachUserId?: string
    table?: string
    patch?: Record<string, unknown>
  }>(req)
  if (!body || !body.coachUserId || !body.table || !body.patch) {
    return json({ error: 'bad_request' }, 400)
  }
  try {
    return await withCoachScope(deps, body.coachUserId, async (client, orgId) => {
      await updateRow(
        client,
        orgId,
        body.table as ScopedTable,
        id,
        body.patch as Record<string, unknown>,
        body.coachUserId as string,
      )
      return json({ ok: true }, 200)
    })
  } catch (err) {
    if (err instanceof ScopedWriteError) return json({ error: 'bad_request' }, 400)
    throw err
  }
}

async function handleDeleteRow(
  deps: HandlerDeps,
  req: Request,
  id: string,
): Promise<Response> {
  const body = await readJsonBody<{
    coachUserId?: string
    table?: string
  }>(req)
  if (!body || !body.coachUserId || !body.table) {
    return json({ error: 'bad_request' }, 400)
  }
  try {
    return await withCoachScope(deps, body.coachUserId, async (client, orgId) => {
      await deleteRow(client, orgId, body.table as ScopedTable, id)
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
  req: Request,
  coachId: string,
): Promise<Response> {
  const body = await readJsonBody<{ draft?: SessionDraftV1 }>(req)
  if (!body || !body.draft) {
    return json({ error: 'bad_request' }, 400)
  }
  return withCoachScope(deps, coachId, async (client, orgId) => {
    const result = await materializeDraft(client, orgId, coachId, body.draft as SessionDraftV1)
    return json(result, 200)
  })
}
