// The admin coach-assist handler: transport/auth concerns only. Every side
// effect is injected via HandlerDeps, so the request lifecycle is unit-testable
// with fakes (see api/handler_test.ts).
//
// Task 1 owns the owner-only gate on GET /status. The route table is additive:
// later tasks append more routes to this same handler.

import { json } from './http.ts'
import type { ServiceRoleClient } from './deps.ts'

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

    return json({ error: 'not_found' }, 404)
  }
}

async function handleStatus(deps: HandlerDeps, req: Request): Promise<Response> {
  const callerUid = await deps.getCallerUid(req)
  // Owner gate: a missing/unverifiable token (null) or a non-owner id is 403.
  if (callerUid === null || !deps.isOwner(callerUid)) {
    return json({ error: 'forbidden' }, 403)
  }
  return json({ isOwner: true }, 200)
}
