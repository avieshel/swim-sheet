// Interactive prompt playground for the AI session harness.
//
// Run:
//   deno run --allow-env --allow-net supabase/evals/repl.ts
//   deno run --allow-env --allow-net supabase/evals/repl.ts "4 x 100 free, last with fins"
//
// Standalone from the application: no browser, no Supabase, no sign-in, no
// rate limit, no Edge Function. It calls the provider directly.
//
// It is only trustworthy because it calls the *same* modules the Edge Function
// does — the sanitizer, the prompt builder, the provider adapter, and the
// shared validator. Changing one of those changes what you see here, so what
// you tune in this REPL is what ships. Nothing here is reimplemented.
//
// Env (all optional):
//   PROVIDER_BASE_URL / PROVIDER_API_KEY / PROVIDER_MODEL / PROVIDER_MAX_TOKENS
//     / PROVIDER_TIMEOUT_MS   read by agent/config.ts
//   Loaded automatically from .env.functions.local — the same file
//     `supabase functions serve --env-file` uses — so both run from one config.
//     Values already in the environment win, so a one-off override still works.
//   REPL_POOL_LENGTH     default 25
//   REPL_DISTANCE_UNITS  default meters
//   REPL_EQUIPMENT       comma separated, default all four
//   REPL_NAMES           comma separated swimmer names, so redaction can be exercised
//
// Commands: /system, /context, /json, /clear, /quit

import { hostFriendlyBaseUrl, loadLocalEnv, LOCAL_ENV_PATH } from './env.ts'
import { currentContext, currentKnownNames, runDraft } from './pipeline.ts'
import type { SessionDraftV1 } from '../../shared/sessionDraft/types.ts'
import { createSessionDraftSeed } from '../../shared/sessionDraft/seed.ts'
import { getProviderConfig } from '../functions/ai-session-harness/agent/provider.ts'
import { buildSystemPrompt } from '../functions/ai-session-harness/agent/prompt.ts'

const DIM = '[2m'
const BOLD = '[1m'
const RED = '[31m'
const GREEN = '[32m'
const YELLOW = '[33m'
const RESET = '[0m'

function describeDraft(draft: SessionDraftV1): string[] {
  const lines: string[] = []
  for (const drill of draft.drills) {
    const reps = drill.repeatCount > 1 ? ` ${drill.repeatCount} sets` : ''
    lines.push(`  ${BOLD}${drill.name}${RESET}${reps}`)
    for (const item of drill.items) {
      const bits = [
        `${item.distance}m`,
        item.stroke,
        `x${item.repeatCount}`,
        item.intensity ?? '-',
        item.interval ?? '',
        (item.equipment ?? []).join('+'),
      ].filter(Boolean)
      lines.push(`    ${DIM}${bits.join('  ')}${RESET}`)
    }
  }
  return lines
}

async function report(text: string, showRaw: boolean): Promise<void> {
  const result = await runDraft({ prompt: text })

  console.log(`\n${DIM}sanitized${RESET}  ${result.sanitized.text}`)
  console.log(
    `${DIM}removed  ${RESET}  ${result.sanitized.removedCategories.length ? result.sanitized.removedCategories.join(', ') : '-'}`,
  )

  if (showRaw) {
    console.log(`\n${DIM}raw${RESET}`)
    console.log(JSON.stringify(result.raw, null, 2))
  }

  if (result.error) {
    console.log(`\n  ${RED}x provider ${result.error.kind}${RESET}  ${result.error.message}`)
  } else if (result.validation && !result.validation.ok) {
    console.log(`\n  ${RED}x rejected${RESET}  ${result.validation.code}: ${result.validation.message}`)
  } else if (result.outcome === 'not_actionable') {
    console.log(`\n  ${YELLOW}- not_actionable${RESET}  ${result.message}`)
  } else if (result.summary && result.raw && typeof result.raw === 'object' && 'draft' in result.raw) {
    const draft = (result.raw as { draft: SessionDraftV1 }).draft
    console.log(
      `\n  ${GREEN}+ draft${RESET}  ${result.summary.drills} drills, ${result.summary.items} items, ${result.summary.totalDistance}m`,
    )
    console.log(describeDraft(draft).join('\n'))
  }

  console.log(`${DIM}took     ${RESET}  ${(result.elapsedMs / 1000).toFixed(1)}s`)
}

function printHeader(loaded: string[]): void {
  const config = getProviderConfig()
  const context = currentContext()
  console.log(`${BOLD}Session draft REPL${RESET} ${DIM}— ${config.model} via ${config.baseUrl}${RESET}`)
  console.log(
    `${DIM}pool ${context.poolLength}${context.distanceUnits}, equipment: ${
      context.equipmentOptions.join(', ') || 'none'
    }${RESET}`,
  )
  if (loaded.length) console.log(`${DIM}loaded from ${LOCAL_ENV_PATH}: ${loaded.join(', ')}${RESET}`)
  const names = currentKnownNames()
  if (names.length) console.log(`${DIM}redacting names: ${names.join(', ')}${RESET}`)
  console.log(`${DIM}type a coach request, or /system /context /json /clear /quit${RESET}\n`)
}

// Line-oriented stdin reader. Hand-rolled rather than pulled from @std so the
// tool has no dependency that could drift under it.
async function* readInputLines(): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of Deno.stdin.readable) {
    buffer += decoder.decode(chunk, { stream: true })
    let index = buffer.indexOf('\n')
    while (index !== -1) {
      yield buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      index = buffer.indexOf('\n')
    }
  }
  buffer += decoder.decode()
  if (buffer.length > 0) yield buffer
}

async function main(): Promise<void> {
  const loaded = loadLocalEnv()

  // The REPL reports every stage itself, so the function's raw debug records
  // would only duplicate it mid-output.
  Deno.env.set('AGENT_DEBUG', 'false')

  const rewritten = hostFriendlyBaseUrl(Deno.env.get('PROVIDER_BASE_URL'))
  if (rewritten && rewritten !== Deno.env.get('PROVIDER_BASE_URL')) {
    Deno.env.set('PROVIDER_BASE_URL', rewritten)
  }

  const config = getProviderConfig()
  if (!config.apiKey) {
    console.error(`PROVIDER_API_KEY is not set. Set it in ${LOCAL_ENV_PATH} or export it directly.`)
    Deno.exit(1)
  }

  const oneShot = Deno.args.find((a) => !a.startsWith('-'))
  if (oneShot) {
    report(oneShot, false)
    return
  }

  printHeader(loaded)

  let showRaw = false
  let queued: string | null = null

  for await (const line of readInputLines()) {
    const text: string = (queued !== null ? queued + ' ' : '') + line
    queued = null
    const input: string = text.trim()
    if (input.length === 0) continue

    if (input.startsWith('/')) {
      const [command, ...rest] = input.slice(1).split(/\s+/)
      if (command === 'quit' || command === 'exit') break
      if (command === 'json') {
        showRaw = !showRaw
        console.log(showRaw ? `${DIM}raw output on${RESET}` : `${DIM}raw output off${RESET}`)
      } else if (command === 'system') {
        console.log(`\n${buildSystemPrompt(currentContext())}\n`)
      } else if (command === 'context') {
        console.log(`\n${JSON.stringify(currentContext(), null, 2)}\n`)
      } else if (command === 'clear') {
        console.log('cleared')
      } else if (command === 'help') {
        console.log('/system /context /json /clear /quit — and prefix a line with \\ to continue it')
      } else {
        console.log(`unknown command: /${command ?? ''}`)
      }
      continue
    }

    // A leading backslash continues the previous line, for long prompts.
    if (input.endsWith('\\')) {
      queued = input.slice(0, -1).trim()
      continue
    }

    report(input, showRaw)
  }
}

await main()