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
import { CORS_HEADERS, json } from './harness/http.ts'
import { isLocalizationProbe, localizationResponse } from './harness/localization.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  // Answer the browser's CORS preflight before any auth or work. A 204 must
  // carry no body, or the Deno runtime throws (EDGE_FUNCTION_ERROR).
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  // Lightweight, agent-free endpoint: serve the canonical drill Hebrew map so
  // the PWA renders localized names without bundling them. The Supabase
  // Functions gateway already requires a valid user JWT, so no extra auth here.
  if (req.method === 'POST') {
    try {
      const probe = await req.clone().json()
      if (isLocalizationProbe(probe)) return localizationResponse()
    } catch {
      // Not a localization probe (or no body) — fall through to the full handler.
    }
  }
  const deps = createDeps()
  if (!deps) return json({ error: 'misconfigured' }, 500)
  return createHandler(deps)(req)
})
