// Admin coach-assist Edge Function — composition root.
//
// Trust boundary: the browser never sees the service-role key. This file only
// wires the real dependencies (api/deps.ts) and delegates request handling to
// the handler (api/handler.ts), which stays independently testable. JWT
// verification is ON at the gateway, so the caller's Authorization bearer token
// is valid and resolves to a real auth.uid().

import { createDeps } from './api/deps.ts'
import { createHandler } from './api/handler.ts'
import { CORS_HEADERS } from './api/http.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  // Answer the browser's CORS preflight before any auth or work. A 204 must
  // carry no body, or the Deno runtime throws (EDGE_FUNCTION_ERROR).
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  const deps = createDeps()
  return createHandler(deps)(req)
})
