import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@supabase/supabase-js'

const mockUser = vi.hoisted(() => ({ user: { id: 'u1', is_anonymous: false } as unknown as User }))

vi.mock('../supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
  getCurrentUser: () => mockUser.user,
}))

vi.mock('../../db/dao', () => ({
  getAllSwimmers: vi.fn(),
}))

vi.mock('../../services/settingsService', () => ({
  settingsService: { getSettings: vi.fn(), getEquipmentOptions: vi.fn() },
}))

vi.mock('../../services/sessionService', () => ({
  sessionService: { list: vi.fn() },
}))

vi.mock('../drills', () => ({
  getSessionDrills: vi.fn(),
}))

const mockApply = vi.hoisted(() => ({ applySessionDraft: vi.fn() }))

vi.mock('../../services/sessionDraft/apply', () => ({
  applySessionDraft: (draft: unknown, options: { markUnreviewed: boolean }) =>
    mockApply.applySessionDraft(draft, options),
}))

import { supabase } from '../supabase'
import { getAllSwimmers } from '../../db/dao'
import { settingsService } from '../../services/settingsService'
import { sessionService } from '../../services/sessionService'
import { getSessionDrills } from '../drills'
import { prepareSessionDraft, requestSessionDraft, applySessionDraft, type PreparedSessionDraft } from '../sessionDraft'
import type { SessionDraftV1 } from '../../../../shared/sessionDraft/types'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config'

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>

function validDraft(): SessionDraftV1 {
  return {
    schemaVersion: 1,
    session: { name: 'Tuesday Endurance' },
    drills: [{ name: 'Warmup', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 2 }] }],
  }
}

// Mirrors the real supabase-js failure: error.context is the fetch Response.
function httpError(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return {
    data: null,
    error: {
      context: new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
      }),
    },
  }
}

function prepared(overrides: Partial<PreparedSessionDraft> = {}): PreparedSessionDraft {
  return {
    prompt: 'A set',
    seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
    context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
    removedCategories: [],
    knownSwimmerNames: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser.user = { id: 'u1', is_anonymous: false } as unknown as User
  vi.mocked(getAllSwimmers).mockResolvedValue([
    { name: 'Emma', group: 'Squad A' },
    { name: 'Liam', group: 'Squad A' },
  ])
  vi.mocked(settingsService.getSettings).mockResolvedValue({
    team_name: '', coach_name: '', team_names: [], pool_length: 25, distance_units: 'm',
    notification_enabled: true, sync_interval: 30000, theme: 'auto', font_size: 'medium',
    auto_save: true, data_retention_days: 90,
  })
  vi.mocked(settingsService.getEquipmentOptions).mockResolvedValue(['fins', 'kickboard'])
  vi.mocked(sessionService.list).mockResolvedValue([])
  vi.mocked(getSessionDrills).mockResolvedValue([])
})

describe('prepareSessionDraft', () => {
  it('builds a context from settings, groups, and equipment (filtered to valid ids)', async () => {
    const prepared = await prepareSessionDraft('Plan a set for Emma and Liam')
    expect(prepared.context.poolLength).toBe(25)
    expect(prepared.context.groupNames).toEqual(['Squad A'])
    expect(prepared.context.equipmentOptions).toEqual(['fins'])
    expect(prepared.context.recentSessions).toEqual([])
    // No swimmer names leak into context.
    expect(JSON.stringify(prepared.context)).not.toContain('Emma')
    expect(prepared.removedCategories).toContain('known_name')
    expect(prepared.prompt).toBe('Plan a set for [removed] and [removed]')
  })
})

describe('requestSessionDraft', () => {
  it('refuses an empty sanitized prompt without calling the function', async () => {
    const result = await requestSessionDraft({
      prompt: '', seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
      removedCategories: [], knownSwimmerNames: [],
    })
    expect(result).toEqual({ outcome: 'invalid' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('refuses an over-long prompt without calling the function', async () => {
    const result = await requestSessionDraft(
      prepared({ prompt: 'x'.repeat(defaultSessionDraftConfig.limits.maxPromptLength + 1) }),
    )
    expect(result).toEqual({ outcome: 'invalid' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('rejects anonymous users before any network call', async () => {
    mockUser.user = { id: 'u1', is_anonymous: true } as unknown as User
    const result = await requestSessionDraft({
      prompt: 'A set', seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
      removedCategories: [], knownSwimmerNames: [],
    })
    expect(result).toEqual({ outcome: 'auth' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('maps a 401 to auth (reading status from the error context Response)', async () => {
    invoke.mockResolvedValue(httpError(401, { error: 'unauthorized' }))
    expect(await requestSessionDraft(prepared())).toEqual({ outcome: 'auth' })
  })

  it('maps a 429 to rate_limited with the echoed retry seconds', async () => {
    invoke.mockResolvedValue(httpError(429, { error: 'rate_limited', retry_after_seconds: 120 }))
    expect(await requestSessionDraft(prepared())).toEqual({ outcome: 'rate_limited', retryAfterSeconds: 120 })
  })

  it('reads retry seconds from the Retry-After header when the body omits them', async () => {
    invoke.mockResolvedValue(httpError(429, { error: 'rate_limited' }, { 'Retry-After': '90' }))
    expect(await requestSessionDraft(prepared())).toEqual({ outcome: 'rate_limited', retryAfterSeconds: 90 })
  })

  it('distinguishes an upstream provider rate limit from the user quota', async () => {
    invoke.mockResolvedValue(httpError(429, { error: 'provider_rate_limited', retry_after_seconds: 30 }))
    expect(await requestSessionDraft(prepared())).toEqual({ outcome: 'provider_rate_limited', retryAfterSeconds: 30 })
  })

  it('falls back to the configured window when a 429 carries no retry hint', async () => {
    invoke.mockResolvedValue(httpError(429, { error: 'rate_limited' }))
    expect(await requestSessionDraft(prepared())).toEqual({
      outcome: 'rate_limited',
      retryAfterSeconds: defaultSessionDraftConfig.limits.rateLimitFallbackSeconds,
    })
  })

  it('maps a 5xx to provider', async () => {
    invoke.mockResolvedValue(httpError(502, { error: 'provider_error' }))
    expect(await requestSessionDraft(prepared())).toEqual({ outcome: 'provider' })
  })

  it('maps a 503 provider-unavailable response to provider', async () => {
    invoke.mockResolvedValue(httpError(503, { error: 'provider_unavailable' }))
    expect(await requestSessionDraft(prepared())).toEqual({ outcome: 'provider' })
  })

  it('treats a statusless error as network', async () => {
    invoke.mockResolvedValue({ data: null, error: {} })
    expect(await requestSessionDraft(prepared())).toEqual({ outcome: 'network' })
  })

  it('treats an invalid payload as invalid', async () => {
    invoke.mockResolvedValue({ data: { schemaVersion: 2 }, error: null })
    const result = await requestSessionDraft({
      prompt: 'A set', seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
      removedCategories: [], knownSwimmerNames: [],
    })
    expect(result).toEqual({ outcome: 'invalid' })
  })

  it('returns a validated draft', async () => {
    invoke.mockResolvedValue({ data: { outcome: 'draft', draft: validDraft() }, error: null })
    const result = await requestSessionDraft({
      prompt: 'A set', seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
      removedCategories: [], knownSwimmerNames: [],
    })
    expect(result).toEqual({ outcome: 'draft', draft: validDraft() })
  })

  it('returns a not_actionable result', async () => {
    invoke.mockResolvedValue({ data: { outcome: 'not_actionable', message: 'Not a session.' }, error: null })
    const result = await requestSessionDraft({
      prompt: 'What is the weather', seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
      removedCategories: [], knownSwimmerNames: [],
    })
    expect(result).toEqual({ outcome: 'not_actionable', message: 'Not a session.' })
  })

  it('blocks output containing a known swimmer name', async () => {
    invoke.mockResolvedValue({
      data: { outcome: 'draft', draft: { ...validDraft(), session: { name: "Emma's set" } } },
      error: null,
    })
    const result = await requestSessionDraft({
      prompt: 'A set', seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
      removedCategories: [], knownSwimmerNames: ['Emma'],
    })
    expect(result).toEqual({ outcome: 'privacy' })
  })
})

describe('applySessionDraft (api wrapper)', () => {
  it('delegates to the service with markUnreviewed true', async () => {
    mockApply.applySessionDraft.mockResolvedValue({ outcome: 'created', sessionId: 's1' })
    const result = await applySessionDraft(validDraft())
    expect(mockApply.applySessionDraft).toHaveBeenCalledWith(validDraft(), { markUnreviewed: true })
    expect(result).toEqual({ outcome: 'created', sessionId: 's1' })
  })
})
