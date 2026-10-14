import { supabase, getCurrentUser } from './supabase'
import { createSessionDraftSeed } from '../services/sessionDraft/seed'
import { sanitizePrompt } from '../services/sessionDraft/sanitize'
import { buildSessionDraftContext } from '../services/sessionDraft/context'
import { validateHarnessResult, isValidPromptLength } from '../services/sessionDraft/validate'
import { applySessionDraft as applyDraftService, keepSessionDraft as keepDraftService, getUnreviewedSessionDraft as getUnreviewedDraftService } from '../services/sessionDraft/apply'
import type {
  ApplyDraftResult,
} from '../services/sessionDraft/apply'
import {
  type ContextInput,
  type EquipmentId,
  type HarnessResult,
  type SessionDraftContext,
  type SessionDraftRequest,
  type SessionDraftSeedV1,
  type SessionDraftV1,
} from '../../../shared/sessionDraft/types'
import { EQUIPMENT_IDS, defaultSessionDraftConfig } from '../../../shared/sessionDraft/config'
import { settingsService } from '../services/settingsService'
import { getAllSwimmers } from '../db/dao'
import { sessionService } from '../services/sessionService'
import { getSessionDrills } from './drills'
import { getDrillTotalDistance } from '../utils/drillHelpers'

// The only client network boundary for the AI draft. Pages never call the Edge
// Function directly.

export interface PreparedSessionDraft {
  prompt: string
  seed: SessionDraftSeedV1
  context: SessionDraftContext
  removedCategories: SessionDraftContext['recentSessions'] extends never ? never : Array<'known_name' | 'email' | 'phone'>
  knownSwimmerNames: string[]
}

export type SessionDraftResult =
  | { outcome: 'draft'; draft: SessionDraftV1 }
  | { outcome: 'not_actionable'; message: string }
  | { outcome: 'invalid' }
  | { outcome: 'network' }
  | { outcome: 'auth' }
  | { outcome: 'rate_limited'; retryAfterSeconds: number }
  | { outcome: 'privacy' }
  | { outcome: 'timeout' }
  | { outcome: 'provider' }

async function buildRecentSessions(): Promise<ContextInput['recentSessions']> {
  const sessions = (await sessionService.list()).slice(0, defaultSessionDraftConfig.limits.maxRecentSessions)
  return Promise.all(
    sessions.map(async (session) => {
      const drills = await getSessionDrills(session.id)
      return {
        totalDistance: drills.reduce((sum, drill) => sum + getDrillTotalDistance(drill), 0),
        drills: drills.map((drill) => ({
          distance: drill.distance,
          stroke: drill.stroke,
          repeatCount: drill.repeatCount,
        })),
      }
    }),
  )
}

export async function prepareSessionDraft(prompt: string): Promise<PreparedSessionDraft> {
  const seed = createSessionDraftSeed()
  const settings = await settingsService.getSettings()
  const swimmers = await getAllSwimmers()
  const knownSwimmerNames = swimmers.map((s) => s.name)
  const groupNames = [...new Set(swimmers.map((s) => s.group).filter((g) => g.length > 0))]

  const equipmentOptions = (await settingsService.getEquipmentOptions())
    .filter((option) => (EQUIPMENT_IDS as readonly string[]).includes(option))
    .map((option) => option as EquipmentId)

  const contextInput: ContextInput = {
    poolLength: settings.pool_length,
    distanceUnits: settings.distance_units,
    groupNames,
    knownSwimmerNames,
    equipmentOptions,
    recentSessions: await buildRecentSessions(),
  }

  const context = buildSessionDraftContext(contextInput)
  const sanitized = sanitizePrompt(prompt, knownSwimmerNames)

  return {
    prompt: sanitized.text,
    seed,
    context,
    removedCategories: sanitized.removedCategories,
    knownSwimmerNames,
  }
}

function mapInvokeError(error: { status?: number; message?: string }): SessionDraftResult {
  const status = error.status
  if (status === 401 || status === 403) return { outcome: 'auth' }
  if (status === 429) return { outcome: 'rate_limited', retryAfterSeconds: 3600 }
  if (status === 408) return { outcome: 'timeout' }
  if (status !== undefined && status >= 500) return { outcome: 'provider' }
  return { outcome: 'network' }
}

function containsSwimmerName(result: HarnessResult, names: string[]): boolean {
  const lowered = names.map((n) => n.trim().toLowerCase()).filter(Boolean)
  if (lowered.length === 0) return false
  const texts: string[] =
    result.outcome === 'draft'
      ? [result.draft.session.name, ...result.draft.drills.map((d) => d.name)]
      : [result.message]
  return texts.some((text) => lowered.some((name) => text.toLowerCase().includes(name)))
}

export async function requestSessionDraft(prepared: PreparedSessionDraft): Promise<SessionDraftResult> {
  if (!isValidPromptLength(prepared.prompt) || !prepared.prompt.trim()) {
    return { outcome: 'invalid' }
  }

  const user = getCurrentUser()
  if (!user || user.is_anonymous) {
    return { outcome: 'auth' }
  }

  const body: SessionDraftRequest = {
    prompt: prepared.prompt,
    seed: prepared.seed,
    context: prepared.context,
  }

  const { data, error } = await supabase.functions.invoke('ai-session-harness', { body })
  if (error) return mapInvokeError(error)

  const validation = validateHarnessResult(data)
  if (!validation.ok) return { outcome: 'invalid' }
  if (containsSwimmerName(validation.value, prepared.knownSwimmerNames)) {
    return { outcome: 'privacy' }
  }

  return validation.value.outcome === 'draft'
    ? { outcome: 'draft', draft: validation.value.draft }
    : { outcome: 'not_actionable', message: validation.value.message }
}

// Persist an actionable draft as a local, unreviewed session.
export async function applySessionDraft(draft: SessionDraftV1): Promise<ApplyDraftResult> {
  return applyDraftService(draft, { markUnreviewed: true })
}

// Mark an unreviewed draft as a normal, kept session (clears the local marker).
export async function keepSessionDraft(id: string): Promise<void> {
  return keepDraftService(id)
}

// The single local unreviewed draft, if one exists.
export async function getUnreviewedSessionDraft() {
  return getUnreviewedDraftService()
}
