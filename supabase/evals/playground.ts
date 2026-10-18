// Browser playground for the AI session draft agent.
//
//   deno run --allow-env --allow-net --allow-read supabase/evals/playground.ts
//   → http://127.0.0.1:8788
//
// The CLI REPL is awkward for actually iterating on a prompt: you cannot see the
// prompt and its result side by side, and you scroll through terminal noise.
// This serves the same pipeline as a page that shows every stage at once —
// input, sanitised text, system prompt, context sent, raw model output, and the
// verdict — so a prompt edit can be judged immediately.
//
// Binds to loopback only. It sends whatever you type to a real provider, so it
// must never be reachable from the network.

import { loadLocalEnv, hostFriendlyBaseUrl, LOCAL_ENV_PATH } from './env.ts'
import { PAGE } from './playground-page.ts'
import { currentContext, currentKnownNames, runDraft } from './pipeline.ts'
import { getProviderConfig } from '../functions/ai-session-harness/agent/provider.ts'

const PORT = Number.parseInt(Deno.env.get('PLAYGROUND_PORT') ?? '8788', 10)

loadLocalEnv()
const rewritten = hostFriendlyBaseUrl(Deno.env.get('PROVIDER_BASE_URL'))
if (rewritten && rewritten !== Deno.env.get('PROVIDER_BASE_URL')) {
  Deno.env.set('PROVIDER_BASE_URL', rewritten)
}
// The page reports each stage itself, so the function's raw debug records would
// only duplicate them.
Deno.env.set('AGENT_DEBUG', 'false')

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve({ hostname: '127.0.0.1', port: PORT }, async (req) => {
  const url = new URL(req.url)

  if (url.pathname === '/') return new Response(PAGE, { headers: { 'Content-Type': 'text/html' } })

  if (url.pathname === '/api/config') {
    const config = getProviderConfig()
    const context = currentContext()
    return json({
      model: config.model,
      baseUrl: config.baseUrl,
      poolLength: context.poolLength,
      distanceUnits: context.distanceUnits,
      equipment: context.equipmentOptions,
      knownNames: currentKnownNames(),
      envFile: LOCAL_ENV_PATH,
    })
  }

  if (url.pathname === '/api/draft' && req.method === 'POST') {
    const body = await req.json().catch(() => null) as { prompt?: string } | null
    const prompt = typeof body?.prompt === 'string' ? body.prompt : ''
    if (prompt.trim().length === 0) return json({ error: 'prompt is required' }, 400)
    const result = await runDraft({ prompt })
    return json({ ...result, elapsedMs: result.elapsedMs })
  }

  return json({ error: 'not found' }, 404)
})

console.log(`Playground on http://127.0.0.1:${PORT}`)
console.log(`Provider settings from ${LOCAL_ENV_PATH}. Ctrl-C to stop.`)