// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUserId = vi.hoisted(() => vi.fn<() => string | null>(() => null))
vi.mock('../../api/supabase', () => ({ getCurrentUserId: mockGetCurrentUserId }))

vi.mock('../deviceContext', () => ({
  getFullDeviceContext: vi.fn(async () => ({
    country: 'IL',
    language: 'en-US',
    os: 'macOS',
    type: 'desktop',
    screen: '1440x900',
    connection: '4g',
  })),
}))

import { analytics, isNewSession } from '../analyticsService'

const QUEUE_KEY = 'swimsheet_analytics_queue'
const SESSION_ID_KEY = 'swimsheet_session_id'
const SESSION_START_KEY = 'swimsheet_session_start'
const SESSION_LAST_KEY = 'swimsheet_session_last'
const DEAD_LETTER_KEY = 'swimsheet_analytics_dead_letter'

interface Row {
  event_id: string
  event_name: string
  properties: Record<string, unknown>
  user_id: string | null
  session_id: string
  app_version: string
  platform: string
  device_country?: string | null
  device_language?: string
  device_os?: string
  device_type?: string
  device_screen?: string
  device_connection?: string | null
}

function okResponse() {
  return { ok: true, status: 201, json: async () => ({}) }
}

function errResponse(status: number, code: string) {
  return { ok: false, status, json: async () => ({ code, message: `error ${code}` }) }
}

function queued(): Row[] {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as Row[]
}

function deadLetter(): Array<{ event: Row; error_code: string }> {
  return JSON.parse(localStorage.getItem(DEAD_LETTER_KEY) || '[]') as Array<{
    event: Row
    error_code: string
  }>
}

function sentRows(callIndex: number): Row[] {
  const call = fetchMock.mock.calls[callIndex]
  return JSON.parse(String(call[1]?.body)) as Row[]
}

const fetchMock = vi.fn()

function drain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('analyticsService', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    mockGetCurrentUserId.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('enqueues and flushes an event with event_id, session, and build metadata', async () => {
    analytics.track({ name: 'view_swimmers', properties: { swimmer_count: 3 } })
    await drain()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const rows = sentRows(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].event_name).toBe('view_swimmers')
    expect(rows[0].properties).toEqual({ swimmer_count: 3 })
    expect(rows[0].event_id).toEqual(expect.any(String))
    expect(rows[0].event_id.length).toBeGreaterThan(0)
    expect(rows[0].session_id).toEqual(expect.any(String))
    expect(rows[0].app_version).toBe('dev')
    expect(rows[0].platform).toBe('pwa')
    expect(rows[0].device_country).toBe('IL')
    expect(rows[0].device_language).toBe('en-US')
    expect(rows[0].device_os).toBe('macOS')
    expect(rows[0].device_type).toBe('desktop')
    expect(rows[0].device_screen).toBe('1440x900')
    expect(rows[0].device_connection).toBe('4g')
    expect(queued()).toHaveLength(0)
  })

  it('delivers events with no logged-in user using only the anon key', async () => {
    mockGetCurrentUserId.mockReturnValue(null)

    analytics.track({ name: 'app_opened' })
    await drain()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const rows = sentRows(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBeNull()

    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers.apikey).toBe('test-anon-key')
    expect(headers.Authorization).toBe('Bearer test-anon-key')
    expect(queued()).toHaveLength(0)
  })

  it('stamps user_id when a Supabase session exists', async () => {
    mockGetCurrentUserId.mockReturnValue('user-123')

    analytics.track({ name: 'app_opened' })
    await drain()

    expect(sentRows(0)[0].user_id).toBe('user-123')
  })

  it('does not duplicate the batch when a flush fails and is retried later', async () => {
    fetchMock.mockResolvedValueOnce(errResponse(500, 'XX000'))

    analytics.track({ name: 'view_swimmers' })
    await drain()

    expect(queued()).toHaveLength(1)

    fetchMock.mockResolvedValue(okResponse())
    await analytics.flush()
    await drain()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentRows(1)).toHaveLength(1)
    expect(queued()).toHaveLength(0)
  })

  it('isolates a poison event, dead-letters it, and delivers the rest', async () => {
    const mk = (name: string): Row => ({
      event_id: `id-${name}`,
      event_name: name,
      properties: {},
      user_id: null,
      session_id: 's',
      app_version: 'dev',
      platform: 'pwa',
    })
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([mk('good1'), mk('poison'), mk('good2')])
    )

    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const rows = JSON.parse(String(init?.body)) as Row[]
      if (rows.length > 1) return errResponse(400, '23503')
      return rows[0].event_name === 'poison'
        ? errResponse(400, '23503')
        : okResponse()
    })

    await analytics.flush()

    expect(queued()).toHaveLength(0)
    expect(deadLetter()).toHaveLength(1)
    expect(deadLetter()[0].event.event_name).toBe('poison')
    expect(deadLetter()[0].error_code).toBe('23503')
  })

  it('treats a unique violation as delivered instead of retrying forever', async () => {
    const mk = (name: string): Row => ({
      event_id: `id-${name}`,
      event_name: name,
      properties: {},
      user_id: null,
      session_id: 's',
      app_version: 'dev',
      platform: 'pwa',
    })
    localStorage.setItem(QUEUE_KEY, JSON.stringify([mk('a'), mk('b')]))
    fetchMock.mockResolvedValue(errResponse(409, '23505'))

    await analytics.flush()

    expect(queued()).toHaveLength(0)
    expect(deadLetter()).toHaveLength(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the queue on systemic errors and retries with backoff', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(errResponse(500, 'XX000'))
    fetchMock.mockResolvedValueOnce(okResponse())

    analytics.track({ name: 'view_swimmers' })
    await vi.advanceTimersByTimeAsync(0)

    expect(queued()).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(queued()).toHaveLength(0)
  })

  it('caps the queue and drops the oldest events', async () => {
    fetchMock.mockResolvedValue(errResponse(500, 'XX000'))
    const seeded = Array.from({ length: 500 }, (_, i) => ({
      event_id: `seed-${i}`,
      event_name: 'seed',
      properties: {},
      user_id: null,
      session_id: 's',
      app_version: 'dev',
      platform: 'pwa',
    }))
    localStorage.setItem(QUEUE_KEY, JSON.stringify(seeded))

    analytics.track({ name: 'view_swimmers' })
    await drain()

    const q = queued()
    expect(q).toHaveLength(500)
    expect(q[q.length - 1].event_name).toBe('view_swimmers')
    expect(q.some(e => e.event_id === 'seed-0')).toBe(false)
  })

  it('uses an immutable session start with sliding last-activity', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T10:00:00Z'))

    analytics.track({ name: 'app_opened' })
    const firstSession = localStorage.getItem(SESSION_ID_KEY)
    const firstStart = localStorage.getItem(SESSION_START_KEY)
    expect(firstStart).toBe(String(Date.now()))

    vi.advanceTimersByTime(10 * 60 * 1000)
    analytics.track({ name: 'app_opened' })

    expect(localStorage.getItem(SESSION_ID_KEY)).toBe(firstSession)
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(firstStart)
    expect(localStorage.getItem(SESSION_LAST_KEY)).toBe(String(Date.now()))
    expect(isNewSession()).toBe(false)

    vi.advanceTimersByTime(31 * 60 * 1000)
    expect(isNewSession()).toBe(true)

    analytics.track({ name: 'app_opened' })
    expect(localStorage.getItem(SESSION_ID_KEY)).not.toBe(firstSession)
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(String(Date.now()))
  })

  it('reports a new session when none exists', () => {
    expect(isNewSession()).toBe(true)
  })

  it('flushes pending events with keepalive on pagehide', async () => {
    fetchMock.mockResolvedValueOnce(errResponse(500, 'XX000'))

    analytics.track({ name: 'view_swimmers' })
    await drain()
    expect(queued()).toHaveLength(1)

    window.dispatchEvent(new Event('pagehide'))
    await drain()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1]?.keepalive).toBe(true)
    expect(queued()).toHaveLength(0)
  })

  it('drops the queue to dead-letter after max retries and resets', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(errResponse(500, 'XX000'))

    analytics.track({ name: 'view_swimmers' })
    await vi.advanceTimersByTimeAsync(0)
    expect(queued()).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Walk through all 4 retries: 30s, 60s, 120s, 120s = 330s total
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(queued()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(60000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(queued()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(120000)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(queued()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(120000)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(queued()).toHaveLength(0)

    const dl = deadLetter()
    expect(dl).toHaveLength(1)
    expect(dl[0].event.event_name).toBe('view_swimmers')
    expect(dl[0].error_code).toBe('MAX_RETRIES_EXCEEDED')
  })

  it('drops a batch to dead-letter on 4xx without retrying and continues flushing', async () => {
    const mk = (name: string): Row => ({
      event_id: 'id-' + name,
      event_name: name,
      properties: {},
      user_id: null,
      session_id: 's',
      app_version: 'dev',
      platform: 'pwa',
    })
    // First batch (50 events, all malformed). Second batch (1 event, succeeds).
    // Seed 50 bad events then track() 1 good one so they go in separate batches.
    const bad = Array.from({ length: 50 }, (_, i) => mk('bad-' + i))
    localStorage.setItem(QUEUE_KEY, JSON.stringify(bad))

    fetchMock.mockResolvedValueOnce(errResponse(400, 'PGRST102'))
    fetchMock.mockResolvedValueOnce(okResponse())

    await analytics.flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Now add a fresh good event and flush again
    analytics.track({ name: 'good' })
    await drain()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(queued()).toHaveLength(0)

    const dl = deadLetter()
    expect(dl.length).toBeGreaterThanOrEqual(20)
    expect(dl[dl.length - 1].error_code).toMatch(/^HTTP_4XX:PGRST102$/)
  })

  it('keeps retrying on network errors', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    fetchMock.mockResolvedValueOnce(okResponse())

    analytics.track({ name: 'view_swimmers' })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(30000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(queued()).toHaveLength(0)
  })

  it('reports queue stats through getStats', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(errResponse(500, 'XX000'))
    fetchMock.mockResolvedValue(okResponse())

    analytics.track({ name: 'view_swimmers' })
    analytics.track({ name: 'view_swimmers' })
    analytics.track({ name: 'view_swimmers' })
    await vi.advanceTimersByTimeAsync(0)

    const failed = analytics.getStats()
    expect(failed.queued).toBe(3)
    expect(failed.flushInProgress).toBe(false)

    await vi.advanceTimersByTimeAsync(30000)
    await vi.advanceTimersByTimeAsync(0)

    const recovered = analytics.getStats()
    expect(recovered.queued).toBe(0)
    expect(recovered.eventsDelivered).toBeGreaterThanOrEqual(3)
  })
})
