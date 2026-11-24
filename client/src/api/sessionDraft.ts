import { supabase, getCurrentUser } from './supabase'
import { config } from '../config'
import { createSessionDraftSeed } from '../../../shared/sessionDraft/seed'
import { sanitizePrompt } from '../../../shared/sessionDraft/sanitize'
import { buildSessionDraftContext } from '../services/sessionDraft/context'
import { validateHarnessResult, validateSessionDraftRequest } from '../services/sessionDraft/validate'
import { applySessionDraft as applyDraftService, draftTotalDistance } from '../services/sessionDraft/apply'
import type {
  ApplyDraftResult,
  ApplySessionDraftOptions,
} from '../services/sessionDraft/apply'
import {
  type ContextInput,
  type EquipmentId,
  type HarnessResult,
  type SessionDraftContext,
  type SessionDraftLibraryCandidateV1,
  type SessionDraftRequest,
  type SessionDraftSeedV1,
  type SessionDraftV1,
} from '../../../shared/sessionDraft/types'
import { EQUIPMENT_IDS, defaultSessionDraftConfig } from '../../../shared/sessionDraft/config'
import { settingsService } from '../services/settingsService'
import { getAllSwimmers } from '../db/dao'
import { sessionService } from '../services/sessionService'
import { getSessionDrills, listLibraryDrills } from './drills'
import { getAnalyticsSessionId } from '../services/analyticsService'
import { Events, analytics } from '../services/analyticsEvents'
import { v7 as uuidv7 } from 'uuid'

// The only client network boundary for the AI draft. Pages never call the Edge
// Function directly.

export interface PreparedSessionDraft {
  prompt: string
  seed: SessionDraftSeedV1
  context: SessionDraftContext
  removedCategories: SessionDraftContext['recentSessions'] extends never ? never : Array<'known_name' | 'email' | 'phone'>
  knownSwimmerNames: string[]
  libraryDrillMap: Record<string, string>
}

export type SessionDraftResult =
  | { outcome: 'draft'; draft: SessionDraftV1 }
  | { outcome: 'not_actionable'; message: string }
  | { outcome: 'invalid'; message?: string }
  | { outcome: 'network' }
  | { outcome: 'auth' }
  | { outcome: 'rate_limited'; retryAfterSeconds: number }
  | { outcome: 'provider_rate_limited'; retryAfterSeconds: number }
  | { outcome: 'privacy' }
  | { outcome: 'timeout' }
  | { outcome: 'provider' }

function isValidRecentDrill(drill: { distance: unknown; stroke: unknown; repeatCount: unknown }): boolean {
  return (
    typeof drill.distance === 'number' &&
    Number.isInteger(drill.distance) &&
    drill.distance > 0 &&
    typeof drill.stroke === 'string' &&
    (defaultSessionDraftConfig.strokeValues as readonly string[]).includes(drill.stroke) &&
    typeof drill.repeatCount === 'number' &&
    Number.isInteger(drill.repeatCount) &&
    drill.repeatCount > 0
  )
}

// Historical sessions can contain drills that no longer satisfy the draft
// contract (a 0-distance drill, an off-list stroke, a 0 repeat). Dropping the
// offending drills — instead of rejecting the whole AI request — keeps
// generation working even when old data is imperfect.
async function buildRecentSessions(): Promise<ContextInput['recentSessions']> {
  const sessions = (await sessionService.list()).slice(0, defaultSessionDraftConfig.limits.maxRecentSessions)
  const built = await Promise.all(
    sessions.map(async (session) => {
      const drills = (await getSessionDrills(session.id))
        .filter(isValidRecentDrill)
        .slice(0, defaultSessionDraftConfig.limits.maxDrills)
        .map((drill) => ({
          distance: drill.distance,
          stroke: drill.stroke,
          repeatCount: drill.repeatCount,
        }))
      if (drills.length === 0) return null
      const totalDistance = drills.reduce((sum, drill) => sum + drill.distance, 0)
      return { totalDistance, drills }
    }),
  )
  return built.filter((session): session is NonNullable<typeof session> => session !== null)
}

function toCandidateItem(item: { distance: number; stroke: string; repeatCount: number; intensity?: string; interval?: string; equipment?: string[]; description?: string }): SessionDraftLibraryCandidateV1['items'][number] | null {
  if (!isValidRecentDrill(item)) return null
  const intensity = (defaultSessionDraftConfig.intensityValues as readonly string[]).includes(item.intensity ?? '')
    ? (item.intensity as SessionDraftLibraryCandidateV1['items'][number]['intensity'])
    : undefined
  const equipment = item.equipment?.filter((e): e is EquipmentId => (EQUIPMENT_IDS as readonly string[]).includes(e))
  return {
    distance: item.distance,
    stroke: item.stroke as SessionDraftLibraryCandidateV1['items'][number]['stroke'],
    repeatCount: item.repeatCount,
    ...(intensity ? { intensity } : {}),
    ...(item.interval ? { interval: item.interval } : {}),
    ...(equipment && equipment.length > 0 ? { equipment } : {}),
    ...(item.description ? { description: item.description } : {}),
  }
}

async function buildLibraryCandidates(): Promise<{ candidates: SessionDraftLibraryCandidateV1[]; libraryDrillMap: Record<string, string> }> {
  const drills = await listLibraryDrills()
  const ranked = [...drills].sort((a, b) => {
    const pop = (b.popularity ?? 0) - (a.popularity ?? 0)
    if (pop !== 0) return pop
    const updated = (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    if (updated !== 0) return updated
    return a.name.localeCompare(b.name)
  })

  const candidates: SessionDraftLibraryCandidateV1[] = []
  const libraryDrillMap: Record<string, string> = {}
  for (const drill of ranked) {
    if (candidates.length >= defaultSessionDraftConfig.limits.maxLibraryCandidates) break
    const rawItems = (drill.items && drill.items.length > 0)
      ? drill.items
      : [{ distance: drill.distance, stroke: drill.stroke, repeatCount: drill.repeatCount ?? 1 }]
    const items = rawItems
      .map(toCandidateItem)
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, defaultSessionDraftConfig.limits.maxStepsPerDrill)
    if (items.length === 0) continue
    const candidateId = `cand_${candidates.length + 1}`
    candidates.push({
      candidateId,
      name: drill.name,
      ...(drill.description ? { description: drill.description } : {}),
      stroke: drill.stroke,
      distance: drill.distance,
      repeatCount: drill.repeatCount ?? 1,
      items,
      ...(drill.focus ? { focus: drill.focus } : {}),
      ...(drill.labels && drill.labels.length > 0 ? { labels: drill.labels.slice(0, defaultSessionDraftConfig.limits.maxCandidateLabels) } : {}),
    })
    libraryDrillMap[candidateId] = drill.id
  }
  return { candidates, libraryDrillMap }
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

  const { candidates: libraryCandidates, libraryDrillMap } = await buildLibraryCandidates()

  const contextInput: ContextInput = {
    poolLength: settings.pool_length,
    distanceUnits: settings.distance_units,
    groupNames,
    knownSwimmerNames,
    equipmentOptions,
    recentSessions: await buildRecentSessions(),
    libraryCandidates,
  }

  const context = buildSessionDraftContext(contextInput)
  const sanitized = sanitizePrompt(prompt, knownSwimmerNames)

  return {
    prompt: sanitized.text,
    seed,
    context,
    removedCategories: sanitized.removedCategories,
    knownSwimmerNames,
    libraryDrillMap,
  }
}

// supabase-js throws a FunctionsHttpError whose `context` is the fetch Response;
// it does not expose the status directly, so read it (and the retry hint) from
// the Response. The harness echoes `retry_after_seconds` in the body as well as
// the standard Retry-After header.
interface InvokeErrorLike {
  status?: number
  message?: string
  context?: unknown
}

interface HarnessErrorBody {
  error?: string
  retry_after_seconds?: number
}

async function readErrorBody(context: Response): Promise<HarnessErrorBody> {
  try {
    const parsed = (await context.clone().json()) as unknown
    return parsed !== null && typeof parsed === 'object' ? (parsed as HarnessErrorBody) : {}
  } catch {
    return {}
  }
}

function readRetryHeader(context: Response): number | undefined {
  const raw = context.headers.get('Retry-After')
  if (!raw) return undefined
  const seconds = Number.parseInt(raw, 10)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

async function mapInvokeError(error: InvokeErrorLike): Promise<SessionDraftResult> {
  const context = error.context
  const isResponse = context instanceof Response
  const status = isResponse ? context.status : error.status

  if (status === 401 || status === 403) return { outcome: 'auth' }
  if (status === 400 || status === 422) return { outcome: 'invalid' }
  if (status === 408) return { outcome: 'timeout' }
  if (status === 429) {
    const body = isResponse ? await readErrorBody(context) : {}
    const headerSeconds = isResponse ? readRetryHeader(context) : undefined
    const bodySeconds =
      typeof body.retry_after_seconds === 'number' && body.retry_after_seconds > 0
        ? body.retry_after_seconds
        : undefined
    const retryAfterSeconds =
      headerSeconds ?? bodySeconds ?? defaultSessionDraftConfig.limits.rateLimitFallbackSeconds
    return body.error === 'provider_rate_limited'
      ? { outcome: 'provider_rate_limited', retryAfterSeconds }
      : { outcome: 'rate_limited', retryAfterSeconds }
  }
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

// Turn a server-validated harness result into the client-facing outcome,
// including the privacy guard and the draft/not_actionable distinction.
function shapeResult(value: unknown, knownSwimmerNames: string[]): SessionDraftResult {
  const validation = validateHarnessResult(value)
  if (!validation.ok) return { outcome: 'invalid', message: validation.error.message }
  if (containsSwimmerName(validation.value, knownSwimmerNames)) return { outcome: 'privacy' }
  return validation.value.outcome === 'draft'
    ? { outcome: 'draft', draft: validation.value.draft }
    : { outcome: 'not_actionable', message: validation.value.message }
}

export async function requestSessionDraft(prepared: PreparedSessionDraft): Promise<SessionDraftResult> {
  const body: SessionDraftRequest = {
    prompt: prepared.prompt,
    seed: prepared.seed,
    context: prepared.context,
    analyticsSessionId: getAnalyticsSessionId(),
    traceId: uuidv7(),
  }
  // Validate the request we are about to send; the harness validates it again.
  const requestCheck = validateSessionDraftRequest(body)
  if (!requestCheck.ok) {
    analytics.track(Events.AiDraftFailed('invalid'))
    return { outcome: 'invalid', message: requestCheck.message }
  }

  const user = getCurrentUser()
  if (!user || user.is_anonymous) {
    analytics.track(Events.AiDraftFailed('auth'))
    return { outcome: 'auth' }
  }

  analytics.track(Events.AiDraftRequested('harness'))
  const { data, error } = await supabase.functions.invoke('ai-session-harness', { body })
  if (error) {
    const mapped = await mapInvokeError(error)
    analytics.track(Events.AiDraftFailed(mapped.outcome))
    return mapped
  }

  const result = shapeResult(data, prepared.knownSwimmerNames)
  if (result.outcome === 'draft') {
    analytics.track(Events.AiDraftGenerated(result.draft.drills.length, draftTotalDistance(result.draft), 'harness'))
  } else {
    analytics.track(Events.AiDraftFailed(result.outcome))
  }
  return result
}

// Streaming counterpart. Negotiates `text/event-stream` so the harness returns
// Server-Sent Events: incremental `delta` frames for a live preview, then a
// final `done`/`error` frame. Used by the AI draft page for responsive UX; the
// non-streaming `requestSessionDraft` remains for callers/tests that want JSON.
export interface DraftStreamHandlers {
  onDelta?: (text: string) => void
  onDone?: (result: SessionDraftResult) => void
  onError?: (result: SessionDraftResult) => void
}

interface StreamFrame {
  type?: string
  text?: string
  result?: unknown
  outcome?: string
  retryAfterSeconds?: number
  message?: string
}

function streamErrorToResult(frame: StreamFrame): SessionDraftResult {
  switch (frame.outcome) {
    case 'provider_rate_limited':
    case 'rate_limited':
      return {
        outcome: frame.outcome,
        retryAfterSeconds:
          typeof frame.retryAfterSeconds === 'number' && frame.retryAfterSeconds > 0
            ? frame.retryAfterSeconds
            : defaultSessionDraftConfig.limits.rateLimitFallbackSeconds,
      }
    case 'invalid':
      return { outcome: 'invalid', message: frame.message }
    case 'timeout':
      return { outcome: 'timeout' }
    case 'provider':
      return { outcome: 'provider' }
    case 'network':
      return { outcome: 'network' }
    default:
      return { outcome: 'network' }
  }
}

export async function requestSessionDraftStream(
  prepared: PreparedSessionDraft,
  handlers: DraftStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const body: SessionDraftRequest = {
    prompt: prepared.prompt,
    seed: prepared.seed,
    context: prepared.context,
    analyticsSessionId: getAnalyticsSessionId(),
    traceId: uuidv7(),
  }
  let terminalHandled = false
  const fail = (result: SessionDraftResult) => {
    if (terminalHandled) return
    terminalHandled = true
    analytics.track(Events.AiDraftFailed(result.outcome))
    handlers.onError?.(result)
  }
  const done = (result: SessionDraftResult) => {
    if (terminalHandled) return
    terminalHandled = true
    if (result.outcome === 'draft') {
      analytics.track(Events.AiDraftGenerated(result.draft.drills.length, draftTotalDistance(result.draft), 'harness'))
    } else {
      analytics.track(Events.AiDraftFailed(result.outcome))
    }
    handlers.onDone?.(result)
  }
  const isAbort = (err: unknown) =>
    signal?.aborted === true || (err instanceof DOMException && err.name === 'AbortError')

  const requestCheck = validateSessionDraftRequest(body)
  if (!requestCheck.ok) {
    fail({ outcome: 'invalid', message: requestCheck.message })
    return
  }
  const user = getCurrentUser()
  if (!user || user.is_anonymous) {
    fail({ outcome: 'auth' })
    return
  }

  const url = `${config.getSupabaseUrl()}/functions/v1/ai-session-harness`
  const anonKey = config.getSupabaseAnonKey()
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    fail({ outcome: 'auth' })
    return
  }

  analytics.track(Events.AiDraftRequested('harness'))
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (isAbort(err)) return
    fail({ outcome: 'network' })
    return
  }

  if (!response.ok) {
    fail(await mapInvokeError({ status: response.status, context: response }))
    return
  }

  const resBody = response.body
  if (!resBody) {
    fail({ outcome: 'network' })
    return
  }

  const reader = resBody.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break
      buffer += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const line = block.split('\n').find((l) => l.startsWith('data:'))
        if (!line) continue
        const jsonStr = line.slice(5).trim()
        let frame: StreamFrame
        try {
          frame = JSON.parse(jsonStr) as StreamFrame
        } catch {
          continue
        }
        if (frame.type === 'delta' && typeof frame.text === 'string') {
          handlers.onDelta?.(frame.text)
        } else if (frame.type === 'done' && frame.result !== undefined) {
          done(shapeResult(frame.result, prepared.knownSwimmerNames))
        } else if (frame.type === 'error') {
          fail(streamErrorToResult(frame))
        }
      }
    }
  } catch (err) {
    if (isAbort(err)) return
    fail({ outcome: 'network' })
    return
  }
  if (!terminalHandled && !signal?.aborted) {
    fail({ outcome: 'network' })
  }
}

// Persist an actionable draft as a normal session template. The AI step is just a
// faster way to populate the drills, so the saved session is immediately a kept
// template — no separate review gate, identical to a manually built session.
export async function applySessionDraft(
  draft: SessionDraftV1,
  options: ApplySessionDraftOptions = {},
): Promise<ApplyDraftResult> {
  return applyDraftService(draft, options)
}
