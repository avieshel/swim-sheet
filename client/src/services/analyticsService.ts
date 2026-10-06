import { getCurrentUserId } from '../api/supabase'
import { config } from '../config'
import { getFullDeviceContext, type DeviceContext } from './deviceContext'
import { v7 as uuidv7 } from 'uuid'

const DEVICE_ID_KEY = 'swimsheet_device_id'
const ANALYTICS_QUEUE_KEY = 'swimsheet_analytics_queue'
const DEAD_LETTER_KEY = 'swimsheet_analytics_dead_letter'
const SESSION_ID_KEY = 'swimsheet_session_id'
const SESSION_START_KEY = 'swimsheet_session_start'
const SESSION_LAST_KEY = 'swimsheet_session_last'

const SESSION_TIMEOUT_MS = 30 * 60 * 1000
const MAX_QUEUE = 500
const MAX_DEAD_LETTER = 20
const BATCH_SIZE = 50
const RETRY_BASE_MS = 30000
const RETRY_MAX_MS = 120000
const RETRY_MAX_ATTEMPTS = 4

const APP_VERSION = import.meta.env.VITE_GIT_COMMIT?.slice(0, 7) || 'dev'
const PLATFORM = 'pwa'
const REST_TABLE_PATH = '/rest/v1/analytics_events'

export interface TrackedEvent {
  name: string
  properties?: Record<string, unknown>
}

interface AnalyticsEvent {
  event_id: string
  event_name: string
  properties: Record<string, unknown>
  user_id: string | null
  device_id: string
  session_id: string
  timestamp: number
  device_created_tstamp: number
  device_sent_tstamp: number | null
  device_local_tstamp: number
  timezone: string
}

interface DeadLetter {
  event: AnalyticsEvent
  error_code: string
  at: number
}

interface BatchOutcome {
  sent: string[]
  dead: DeadLetter[]
  systemic: boolean
  retryable: boolean
  code?: string
}

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'unknown'
  }
}

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = uuidv7()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return 'anonymous-device'
  }
}

function getSessionLastActivity(): number {
  const last = localStorage.getItem(SESSION_LAST_KEY)
  if (last) return Number(last)
  const legacyStart = localStorage.getItem(SESSION_START_KEY)
  if (legacyStart) return Number(legacyStart)
  return 0
}

export function isNewSession(): boolean {
  try {
    const sessionId = localStorage.getItem(SESSION_ID_KEY)
    const last = getSessionLastActivity()
    if (!sessionId || !last) return true
    return Date.now() - last > SESSION_TIMEOUT_MS
  } catch {
    return true
  }
}

function getOrCreateSessionId(): string {
  try {
    const now = Date.now()
    const last = getSessionLastActivity()
    let sessionId = localStorage.getItem(SESSION_ID_KEY)

    if (!sessionId || !last || now - last > SESSION_TIMEOUT_MS) {
      sessionId = uuidv7()
      localStorage.setItem(SESSION_ID_KEY, sessionId)
      localStorage.setItem(SESSION_START_KEY, String(now))
      localStorage.setItem(SESSION_LAST_KEY, String(now))
    } else {
      localStorage.setItem(SESSION_LAST_KEY, String(now))
    }

    return sessionId
  } catch {
    return 'anonymous-session'
  }
}

function getQueue(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(ANALYTICS_QUEUE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    let changed = false
    const events = parsed.map(item => {
      const e = item as Partial<AnalyticsEvent>
      if (typeof e.event_id !== 'string' || !e.event_id) {
        changed = true
        return {
          ...e,
          event_id: uuidv7(),
          properties: e.properties ?? {},
        } as AnalyticsEvent
      }
      return e as AnalyticsEvent
    })
    if (changed) saveQueue(events)
    return events
  } catch {
    return []
  }
}

function saveQueue(queue: AnalyticsEvent[]): void {
  try {
    const capped =
      queue.length > MAX_QUEUE ? queue.slice(queue.length - MAX_QUEUE) : queue
    localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(capped))
  } catch {
    // storage unavailable or full — drop rather than break the app
  }
}

function addDeadLetters(entries: DeadLetter[]): void {
  try {
    const raw = localStorage.getItem(DEAD_LETTER_KEY)
    const current: unknown = raw ? JSON.parse(raw) : []
    const list = Array.isArray(current) ? (current as DeadLetter[]) : []
    const next = [...list, ...entries].slice(-MAX_DEAD_LETTER)
    localStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function toRow(e: AnalyticsEvent, sentAt: number, ctx: DeviceContext): Record<string, unknown> {
  return {
    event_id: e.event_id,
    event_name: e.event_name,
    properties: e.properties,
    user_id: e.user_id,
    device_id: e.device_id,
    session_id: e.session_id,
    timestamp: e.timestamp,
    device_created_tstamp: e.device_created_tstamp,
    device_sent_tstamp: sentAt,
    device_local_tstamp: e.device_local_tstamp,
    timezone: e.timezone,
    app_version: APP_VERSION,
    platform: PLATFORM,
    device_country: ctx.country,
    device_language: ctx.language,
    device_os: ctx.os,
    device_type: ctx.type,
    device_screen: ctx.screen,
    device_connection: ctx.connection,
  }
}

type InsertKind = 'ok' | 'duplicate' | 'poison' | 'systemic'

interface InsertResult {
  kind: InsertKind
  code: string
  retryable: boolean
}

async function insertRows(
  rows: AnalyticsEvent[],
  keepalive: boolean
): Promise<InsertResult> {
  const url = config.getSupabaseUrl()
  const key = config.getSupabaseAnonKey()
  if (!url || !key) return { kind: 'systemic', code: 'NO_CONFIG', retryable: false }

  const sentAt = Date.now()
  try {
    const ctx = await getFullDeviceContext()
    const res = await fetch(`${url}${REST_TABLE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows.map(e => toRow(e, sentAt, ctx))),
      ...(keepalive ? { keepalive: true } : {}),
    })
    if (res.ok) return { kind: 'ok', code: '', retryable: true }

    let code = ''
    try {
      const body = (await res.json()) as { code?: string }
      code = body?.code || ''
    } catch {
      // non-JSON error body
    }
    if (res.status === 409 || code === '23505') {
      return { kind: 'duplicate', code: '23505', retryable: true }
    }
    // SQLSTATE class 22 (data exception) and 23 (integrity constraint)
    // affect individual rows; splitting the batch isolates the poison row.
    if (/^2[23]\d{3}$/.test(code)) {
      return { kind: 'poison', code, retryable: true }
    }
    // 5xx and no-response network errors are transient — worth retrying.
    // 4xx means the server rejected this payload shape; retrying with the
    // same payload produces the same failure, so drop instead.
    const retryable = res.status >= 500 || res.status === 0
    return { kind: 'systemic', code, retryable }
  } catch {
    return { kind: 'systemic', code: 'NETWORK', retryable: true }
  }
}

async function sendBatch(
  batch: AnalyticsEvent[],
  keepalive: boolean
): Promise<BatchOutcome> {
  const ids = batch.map(e => e.event_id)
  const result = await insertRows(batch, keepalive)

  if (result.kind === 'ok' || result.kind === 'duplicate') {
    return { sent: ids, dead: [], systemic: false, retryable: result.retryable }
  }
  if (result.kind === 'systemic') {
    return { sent: [], dead: [], systemic: true, retryable: result.retryable, code: result.code }
  }

  if (batch.length === 1) {
    return {
      sent: [],
      dead: [{ event: batch[0], error_code: result.code, at: Date.now() }],
      systemic: false,
      retryable: result.retryable,
    }
  }

  const mid = Math.ceil(batch.length / 2)
  const first = await sendBatch(batch.slice(0, mid), keepalive)
  if (first.systemic) return first
  const second = await sendBatch(batch.slice(mid), keepalive)
  return {
    sent: [...first.sent, ...second.sent],
    dead: [...first.dead, ...second.dead],
    systemic: second.systemic,
    retryable: second.retryable,
  }
}

let flushing = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempts = 0
let eventsProduced = 0
let eventsDelivered = 0
let eventsDeadLettered = 0

function cancelRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function scheduleRetry(retryable: boolean): void {
  if (!retryable) return
  cancelRetry()
  const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempts, RETRY_MAX_MS)
  retryAttempts = Math.min(retryAttempts + 1, RETRY_MAX_ATTEMPTS)
  retryTimer = setTimeout(() => {
    retryTimer = null
    void analytics.flush()
  }, delay)
}

async function flush(opts?: { keepalive?: boolean }): Promise<void> {
  if (flushing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  flushing = true
  try {
    let systemic = false
    let retryable = true
    let iterations = 0
    for (;;) {
      const queue = getQueue()
      if (queue.length === 0 || ++iterations > 100) break
      const batch = queue.slice(0, BATCH_SIZE)
      const outcome = await sendBatch(batch, opts?.keepalive === true)
      if (outcome.sent.length > 0 || outcome.dead.length > 0) {
        const remove = new Set([...outcome.sent, ...outcome.dead.map(d => d.event.event_id)])
        saveQueue(getQueue().filter(e => !remove.has(e.event_id)))
        if (outcome.dead.length > 0) addDeadLetters(outcome.dead)
        eventsDelivered += outcome.sent.length
        eventsDeadLettered += outcome.dead.length
      }
      if (outcome.systemic) {
        if (!outcome.retryable) {
          dropBatchToDeadLetter(batch, `HTTP_4XX:${outcome.code ?? 'UNKNOWN'}`)
          saveQueue(getQueue().filter(e => !batch.some(b => b.event_id === e.event_id)))
          eventsDeadLettered += batch.length
          continue
        }
        systemic = true
        retryable = outcome.retryable
        break
      }
      if (opts?.keepalive) break
    }
    if (systemic) {
      if (retryAttempts >= RETRY_MAX_ATTEMPTS) {
        const remaining = getQueue().length
        dropQueueToDeadLetter('MAX_RETRIES_EXCEEDED')
        eventsDeadLettered += remaining
        cancelRetry()
        retryAttempts = 0
      } else {
        scheduleRetry(retryable)
      }
    } else {
      cancelRetry()
      retryAttempts = 0
    }
  } finally {
    flushing = false
  }
}

function dropBatchToDeadLetter(batch: AnalyticsEvent[], errorCode: string): void {
  try {
    const now = Date.now()
    const dead: DeadLetter[] = batch.map(event => ({
      event,
      error_code: errorCode,
      at: now,
    }))
    addDeadLetters(dead)
  } catch {
    // best-effort drop
  }
}

function dropQueueToDeadLetter(reason: string): void {
  try {
    const queue = getQueue()
    if (queue.length === 0) return
    const now = Date.now()
    const dead: DeadLetter[] = queue.map(event => ({
      event,
      error_code: reason,
      at: now,
    }))
    addDeadLetters(dead)
    saveQueue([])
  } catch {
    // best-effort drop
  }
}

export interface AnalyticsStats {
  eventsProduced: number
  eventsDelivered: number
  eventsDeadLettered: number
  queued: number
  flushInProgress: boolean
}

export const analytics = {
  getStats: (): AnalyticsStats => ({
    eventsProduced,
    eventsDelivered,
    eventsDeadLettered,
    queued: getQueue().length,
    flushInProgress: flushing,
  }),

  track: (event: TrackedEvent) => {
    try {
      const createdAt = Date.now()
      const queued: AnalyticsEvent = {
        event_id: uuidv7(),
        event_name: event.name,
        properties: event.properties ?? {},
        user_id: getCurrentUserId(),
        device_id: getDeviceId(),
        session_id: getOrCreateSessionId(),
        timestamp: createdAt,
        device_created_tstamp: createdAt,
        device_sent_tstamp: null,
        device_local_tstamp: createdAt,
        timezone: getTimezone(),
      }

      const queue = getQueue()
      queue.push(queued)
      saveQueue(queue)
      eventsProduced++

      void analytics.flush()
    } catch {
      // analytics should never break user interaction
    }
  },

  flush,
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void analytics.flush()
  })
  window.addEventListener('pagehide', () => {
    void analytics.flush({ keepalive: true })
  })
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void analytics.flush({ keepalive: true })
      }
    })
  }
  ;(window as unknown as Record<string, unknown>).analytics = analytics
}
