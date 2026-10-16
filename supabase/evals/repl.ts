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
//   REPL_POOL_LENGTH     default 25
//   REPL_DISTANCE_UNITS  default meters
//   REPL_EQUIPMENT       comma separated, default all four
//   REPL_NAMES           comma separated swimmer names, so redaction can be exercised
//
// Commands: /system, /context, /json, /clear, /quit

import { sanitizePrompt } from '../../shared/sessionDraft/sanitize.ts'
import { createSessionDraftSeed } from '../../shared/sessionDraft/seed.ts'
import { draftTotalDistance } from '../../shared/sessionDraft/distance.ts'
import { EQUIPMENT_IDS } from '../../shared/sessionDraft/config.ts'
import type { EquipmentId, SessionDraftContext, SessionDraftV1 } from '../../shared/sessionDraft/types.ts'
import { buildSystemPrompt, buildUserContent } from '../functions/ai-session-harness/agent/prompt.ts'
import { callProvider, getProviderConfig, ProviderError } from '../functions/ai-session-harness/agent/provider.ts'
import { validateHarnessResult } from '../functions/ai-session-harness/agent/output.ts'

const DIM = '[2m'
const BOLD = '[1m'
const RED = '[31m'
const GREEN = '[32m'
const YELLOW = '[33m'
const RESET = '[0m'

function envInt(key: string, fallback: number): number {
  const parsed = Number.parseInt(Deno.env.get(key) ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envList(key: string, fallback: string[]): string[] {
  const raw = Deno.env.get(key)
  if (raw === undefined) return fallback
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

const context: SessionDraftContext = {
  poolLength: envInt('REPL_POOL_LENGTH', 25),
  distanceUnits: Deno.env.get('REPL_DISTANCE_UNITS') ?? 'meters',
  groupNames: [],
  equipmentOptions: envList('REPL_EQUIPMENT', [...EQUIPMENT_IDS]) as EquipmentId[],
  recentSessions: [],
}

const knownNames = envList('REPL_NAMES', [])

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

function report(text: string, showRaw: boolean): void {
  const sanitized = sanitizePrompt(text, knownNames)
  console.log(`\n${DIM}sanitized${RESET}  ${sanitized.text}`)
  console.log(
    `${DIM}removed  ${RESET}  ${sanitized.removedCategories.length ? sanitized.removedCategories.join(', ') : '-'}`,
  )

  const request = { prompt: sanitized.text, seed: createSessionDraftSeed(), context }
  const startedAt = performance.now()

  const finish = (): void => {
    console.log(`${DIM}took     ${RESET}  ${((performance.now() - startedAt) / 1000).toFixed(1)}s`)
  }

  callProvider(request, getProviderConfig())
    .then((raw) => {
      if (showRaw) {
        console.log(`\n${DIM}raw${RESET}`)
        console.log(JSON.stringify(raw, null, 2))
      }
      const validation = validateHarnessResult(raw)
      if (!validation.ok) {
        console.log(`\n  ${RED}x rejected${RESET}  ${validation.error.code}: ${validation.error.message}`)
        finish()
        return
      }
      if (validation.value.outcome === 'not_actionable') {
        console.log(`\n  ${YELLOW}- not_actionable${RESET}  ${validation.value.message}`)
        finish()
        return
      }
      const draft = validation.value.draft
      const items = draft.drills.reduce((n, d) => n + d.items.length, 0)
      console.log(
        `\n  ${GREEN}+ draft${RESET}  ${draft.drills.length} drills, ${items} items, ${draftTotalDistance(draft)}m`,
      )
      console.log(describeDraft(draft).join('\n'))
      finish()
    })
    .catch((err: unknown) => {
      const kind = err instanceof ProviderError ? err.kind : 'unknown'
      console.log(`\n  ${RED}x provider ${kind}${RESET}  ${err instanceof Error ? err.message : String(err)}`)
      finish()
    })
}

function printHeader(): void {
  const config = getProviderConfig()
  console.log(`${BOLD}Session draft REPL${RESET} ${DIM}— ${config.model} via ${config.baseUrl}${RESET}`)
  console.log(
    `${DIM}pool ${context.poolLength}${context.distanceUnits}, equipment: ${
      context.equipmentOptions.join(', ') || 'none'
    }${RESET}`,
  )
  if (knownNames.length) console.log(`${DIM}redacting names: ${knownNames.join(', ')}${RESET}`)
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
  const config = getProviderConfig()
  if (!config.apiKey) {
    console.error('PROVIDER_API_KEY is not set. Export it, or see .env.functions.example.')
    Deno.exit(1)
  }

  const oneShot = Deno.args.find((a) => !a.startsWith('-'))
  if (oneShot) {
    report(oneShot, false)
    return
  }

  printHeader()

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
        console.log(`\n${buildSystemPrompt(context)}\n`)
      } else if (command === 'context') {
        console.log(`\n${JSON.stringify(context, null, 2)}\n`)
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