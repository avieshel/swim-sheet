// Opt-in live eval runner for the AI session harness.
//
// Run: deno run --allow-env --allow-net --allow-read supabase/evals/run.ts
//
// Calls the real provider for each case and scores the structured draft. This
// is separate from `deno test` (which only exercises the pure scorer) and must
// not run in normal CI: it needs a provider key, network, and spend. Without
// PROVIDER_API_KEY it prints the plan and exits cleanly.
//
// Provider settings load from .env.functions.local — the same file
// `supabase functions serve --env-file` uses — unless already set in the
// environment.

import { hostFriendlyBaseUrl, loadLocalEnv, LOCAL_ENV_PATH } from './env.ts'
import { callProvider, getProviderConfig } from '../functions/ai-session-harness/agent/provider.ts'
import { validateHarnessResult } from '../functions/ai-session-harness/agent/output.ts'
import type { SessionDraftRequest } from '../functions/ai-session-harness/agent/contract.ts'
import { cases, defaultContext } from './cases.ts'
import { scoreResult } from './scorer.ts'

const seed: SessionDraftRequest['seed'] = { schemaVersion: 1, session: { name: '' }, drills: [] }

async function main(): Promise<number> {
  const loaded = loadLocalEnv()

  const rewritten = hostFriendlyBaseUrl(Deno.env.get('PROVIDER_BASE_URL'))
  if (rewritten && rewritten !== Deno.env.get('PROVIDER_BASE_URL')) {
    Deno.env.set('PROVIDER_BASE_URL', rewritten)
  }

  if (!Deno.env.get('PROVIDER_API_KEY')) {
    console.log(`PROVIDER_API_KEY is not set — skipping live eval. Set it in ${LOCAL_ENV_PATH} or export it. Cases planned:`)
    for (const c of cases) {
      console.log(`  - ${c.id} (expect ${c.expectation.outcome})`)
    }
    return 0
  }

  const config = getProviderConfig()
  let failures = 0

  console.log(`Running ${cases.length} live eval cases against ${config.model}...`)
  if (loaded.length) console.log(`Provider settings loaded from ${LOCAL_ENV_PATH}.`)
  console.log()
  for (const c of cases) {
    const request: SessionDraftRequest = { prompt: c.prompt, seed, context: defaultContext() }
    let outcome = 'error'
    let detail = ''
    try {
      const raw = await callProvider(request, config)
      const validation = validateHarnessResult(raw)
      if (!validation.ok) {
        outcome = 'invalid'
        detail = validation.error.message
      } else {
        const score = scoreResult(validation.value, c.expectation)
        outcome = score.passed ? 'pass' : 'fail'
        detail = score.failures.join('; ')
      }
    } catch (err) {
      outcome = 'error'
      detail = err instanceof Error ? err.message : String(err)
    }
    const ok = outcome === 'pass'
    if (!ok) failures++
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${c.id} — ${outcome}${detail ? ` (${detail})` : ''}`)
  }

  console.log(`\n${cases.length - failures}/${cases.length} passed.`)
  return failures === 0 ? 0 : 1
}

Deno.exit(await main())
