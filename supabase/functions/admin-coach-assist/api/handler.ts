// The admin coach-assist handler: transport/auth concerns only. Every side
// effect is injected via HandlerDeps, so the request lifecycle is unit-testable
// with fakes (see api/handler_test.ts).
//
// Task 1 owns the owner-only gate on GET /status. The route table is additive:
// later tasks append more routes to this same handler.

import { json } from './http.ts'
import type { ServiceRoleClient } from './deps.ts'
import {
  listCoaches,
  resolveCoachOrg,
  CoachResolutionError,
} from '../service/adminService.ts'

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

    const coachMatch = url.pathname.match(/^\/coaches\/([^/]+)$/)
    if (req.method === 'GET' && coachMatch) {
      return withOwner(deps, req, () => handleCoachOrg(deps, coachMatch[1]))
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
