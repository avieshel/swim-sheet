// One draft run, shared by every developer tool.
//
// The CLI REPL and the web playground both call this, so what you see in the
// browser is exactly what the CLI shows and exactly what the Edge Function
// does. The pipeline is deliberately thin: sanitize, build the request, make
// one provider call, validate. All the interesting behaviour lives in the
// shared modules it delegates to.

import { sanitizePrompt } from '../../shared/sessionDraft/sanitize.ts'
import { createSessionDraftSeed } from '../../shared/sessionDraft/seed.ts'
import { draftTotalDistance } from '../../shared/sessionDraft/distance.ts'
import { EQUIPMENT_IDS } from '../../shared/sessionDraft/config.ts'
import type { EquipmentId, SessionDraftContext, SessionDraftV1 } from '../../shared/sessionDraft/types.ts'
import { buildSystemPrompt, buildUserContent } from '../functions/ai-session-harness/agent/prompt.ts'
import { callProvider, getProviderConfig, ProviderError } from '../functions/ai-session-harness/agent/provider.ts'
import { validateHarnessResult } from '../functions/ai-session-harness/agent/output.ts'

export interface DraftRunRequest {
  prompt: string
  /** Swimmer names to redact, standing in for the real roster. */
  knownNames?: string[]
  context?: Partial<SessionDraftContext>
}

export interface DraftRunResult {
  ok: boolean
  elapsedMs: number
  model: string
  baseUrl: string
  sanitized: { text: string; removedCategories: string[] }
  systemPrompt: string
  userContent: string
  raw: unknown
  outcome?: 'draft' | 'not_actionable'
  message?: string
  summary?: { drills: number; items: number; totalDistance: number }
  validation?: { ok: boolean; code?: string; message?: string }
  error?: { kind: string; message: string }
}

function envInt(key: string, fallback: number): number {
  const parsed = Number.parseInt(Deno.env.get(key) ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envList(key: string, fallback: string[]): string[] {
  const raw = Deno.env.get(key)
  if (raw === undefined) return fallback
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Built per call so a changed REPL_* value takes effect without a restart. */
export function currentContext(): SessionDraftContext {
  return {
    poolLength: envInt('REPL_POOL_LENGTH', 25),
    distanceUnits: Deno.env.get('REPL_DISTANCE_UNITS') ?? 'meters',
    groupNames: envList('REPL_GROUPS', []),
    equipmentOptions: envList('REPL_EQUIPMENT', [...EQUIPMENT_IDS]) as EquipmentId[],
    recentSessions: [],
  }
}

export function currentKnownNames(): string[] {
  return envList('REPL_NAMES', [])
}

export function summarizeDraft(draft: SessionDraftV1): DraftRunResult['summary'] {
  return {
    drills: draft.drills.length,
    items: draft.drills.reduce((total, drill) => total + drill.items.length, 0),
    totalDistance: draftTotalDistance(draft),
  }
}

export async function runDraft(request: DraftRunRequest): Promise<DraftRunResult> {
  const base: DraftRunResult = {
    ok: false,
    elapsedMs: 0,
    model: '',
    baseUrl: '',
    sanitized: { text: '', removedCategories: [] },
    systemPrompt: '',
    userContent: '',
    raw: null,
  }

  const context: SessionDraftContext = { ...currentContext(), ...request.context }
  const sanitized = sanitizePrompt(request.prompt, request.knownNames ?? currentKnownNames())
  const seedRequest = { prompt: sanitized.text, seed: createSessionDraftSeed(), context }

  const config = getProviderConfig()
  const startedAt = performance.now()
  const elapsed = (): number => Math.round(performance.now() - startedAt)

  const result: DraftRunResult = {
    ...base,
    model: config.model,
    baseUrl: config.baseUrl,
    sanitized: { text: sanitized.text, removedCategories: sanitized.removedCategories },
    systemPrompt: buildSystemPrompt(context),
    userContent: buildUserContent(seedRequest),
  }

  try {
    result.raw = await callProvider(seedRequest, config)
  } catch (err) {
    result.elapsedMs = elapsed()
    result.error = {
      kind: err instanceof ProviderError ? err.kind : 'unknown',
      message: err instanceof Error ? err.message : String(err),
    }
    return result
  }

  const validation = validateHarnessResult(result.raw)
  result.elapsedMs = elapsed()

  if (!validation.ok) {
    result.validation = { ok: false, code: validation.error.code, message: validation.error.message }
    return result
  }

  result.validation = { ok: true }
  result.ok = true
  result.outcome = validation.value.outcome

  if (validation.value.outcome === 'not_actionable') {
    result.message = validation.value.message
    return result
  }

  result.summary = summarizeDraft(validation.value.draft)
  return result
}