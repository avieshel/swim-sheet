import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInvoke = vi.fn()

vi.mock('../../api/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}))

const mockOverrides: Record<string, string> = {}
vi.mock('../drillLocalizationOverrides', () => ({
  getDrillHeNameOverride: (slug: string) => mockOverrides[slug] ?? undefined,
}))

const SERVER_MAP = {
  'single-arm-pull': { heName: 'יד אחת' },
  'fingertip-drag': { heName: 'שריטת מים' },
}

import { fetchDrillLocalization, resolveDrillDisplayName } from '../drillLocalizationService'

beforeEach(() => {
  mockInvoke.mockReset()
  for (const k of Object.keys(mockOverrides)) delete mockOverrides[k]
})

describe('drillLocalizationService', () => {
  it('fetches and caches the edge-function Hebrew map', async () => {
    mockInvoke.mockResolvedValue({ data: { localization: SERVER_MAP }, error: null })
    const map = await fetchDrillLocalization()
    expect(mockInvoke).toHaveBeenCalledWith('ai-session-harness', {
      body: { intent: 'drill-localization' },
    })
    expect(map['single-arm-pull']?.heName).toBe('יד אחת')
    // A second call is served from cache without a new network request.
    await fetchDrillLocalization()
    expect(mockInvoke).toHaveBeenCalledTimes(1)
  })

  it('falls back to the provided name when the slug is unknown', () => {
    expect(resolveDrillDisplayName('nope', 'Fallback')).toBe('Fallback')
  })

  it('resolves the server Hebrew name once fetched', async () => {
    mockInvoke.mockResolvedValue({ data: { localization: SERVER_MAP }, error: null })
    await fetchDrillLocalization()
    expect(resolveDrillDisplayName('single-arm-pull', 'Fallback')).toBe('יד אחת')
  })

  it('prefers a per-coach override over the server map', async () => {
    mockInvoke.mockResolvedValue({ data: { localization: SERVER_MAP }, error: null })
    await fetchDrillLocalization()
    mockOverrides['single-arm-pull'] = 'התאמה אישית'
    expect(resolveDrillDisplayName('single-arm-pull', 'Fallback')).toBe('התאמה אישית')
  })

  it('keeps the previous cache when a refresh fails', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { localization: SERVER_MAP }, error: null })
    await fetchDrillLocalization()
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const map = await fetchDrillLocalization(true)
    expect(map['single-arm-pull']?.heName).toBe('יד אחת')
  })
})
