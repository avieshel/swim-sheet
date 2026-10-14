// AI session harness Edge Function — composition root.
//
// Trust boundary: the browser never sees the provider key. The harness
// (harness/handler.ts) verifies the caller's Supabase JWT, rejects anonymous
// users, enforces a private per-user rate limit, runs one structured-output
// agent call (agent/), validates the response, and shapes the HTTP reply.
// This file only wires the real dependencies so the harness and agent stay
// independently testable.

import { createDeps } from './harness/deps.ts'
import { createHandler } from './harness/handler.ts'
import { json } from './harness/http.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  const deps = createDeps()
  if (!deps) return json({ error: 'misconfigured' }, 500)
  return createHandler(deps)(req)
})
