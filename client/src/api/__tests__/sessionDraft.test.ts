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
import { prepareSessionDraft, requestSessionDraft, applySessionDraft } from '../sessionDraft'
import type { SessionDraftV1 } from '../../services/sessionDraft/schema'

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>

function validDraft(): SessionDraftV1 {
  return {
    schemaVersion: 1,
    session: { name: 'Tuesday Endurance' },
    drills: [{ name: 'Warmup', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 2 }] }],
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

  it('maps a 401 to auth', async () => {
    invoke.mockResolvedValue({ data: null, error: { status: 401, message: 'no' } })
    const result = await requestSessionDraft({
      prompt: 'A set', seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
      removedCategories: [], knownSwimmerNames: [],
    })
    expect(result).toEqual({ outcome: 'auth' })
  })

  it('maps a 429 to rate_limited', async () => {
    invoke.mockResolvedValue({ data: null, error: { status: 429, message: 'slow down' } })
    const result = await requestSessionDraft({
      prompt: 'A set', seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
      removedCategories: [], knownSwimmerNames: [],
    })
    expect(result.outcome).toBe('rate_limited')
  })

  it('maps a 5xx to provider', async () => {
    invoke.mockResolvedValue({ data: null, error: { status: 502, message: 'bad gateway' } })
    const result = await requestSessionDraft({
      prompt: 'A set', seed: { schemaVersion: 1, session: { name: '' }, drills: [] },
      context: { poolLength: 25, distanceUnits: 'm', groupNames: [], equipmentOptions: ['fins'], recentSessions: [] },
      removedCategories: [], knownSwimmerNames: [],
    })
    expect(result).toEqual({ outcome: 'provider' })
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
