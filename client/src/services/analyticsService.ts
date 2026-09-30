import { supabase } from '../api/supabase'
import { v7 as uuidv7 } from 'uuid'

const DEVICE_ID_KEY = 'swimsheet_device_id'
const ANALYTICS_QUEUE_KEY = 'swimsheet_analytics_queue'
const SESSION_ID_KEY = 'swimsheet_session_id'
const SESSION_START_KEY = 'swimsheet_session_start'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

interface AnalyticsEvent {
  event_name: string
  properties: Record<string, unknown>
  device_id: string
  session_id: string
  timestamp: number
  device_created_tstamp: number
  device_sent_tstamp: number | null
  device_local_tstamp: number
  timezone: string
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

function getOrCreateSessionId(): string {
  try {
    const now = Date.now()
    const sessionStart = Number(localStorage.getItem(SESSION_START_KEY) || '0')
    let sessionId = localStorage.getItem(SESSION_ID_KEY)

    if (!sessionId || now - sessionStart > SESSION_TIMEOUT_MS) {
      sessionId = uuidv7()
      localStorage.setItem(SESSION_ID_KEY, sessionId)
      localStorage.setItem(SESSION_START_KEY, String(now))
    } else {
      localStorage.setItem(SESSION_START_KEY, String(now))
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
    return JSON.parse(raw) as AnalyticsEvent[]
  } catch {
    return []
  }
}

function saveQueue(queue: AnalyticsEvent[]): void {
  try {
    localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // ignore
  }
}

export const analytics = {
  track: (eventName: string, properties: Record<string, unknown> = {}) => {
    try {
      const createdAt = Date.now()
      const event: AnalyticsEvent = {
        event_name: eventName,
        properties,
        device_id: getDeviceId(),
        session_id: getOrCreateSessionId(),
        timestamp: createdAt,
        device_created_tstamp: createdAt,
        device_sent_tstamp: null,
        device_local_tstamp: createdAt,
        timezone: getTimezone(),
      }

      const queue = getQueue()
      queue.push(event)
      saveQueue(queue)

      // Try flushing immediately if online
      void analytics.flush()
    } catch {
      // analytics should never break user interaction
    }
  },

  flush: async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const queue = getQueue()
    if (queue.length === 0) return

    const sentAt = Date.now()

    try {
      // Send batch to Supabase analytics_events table
      const batch = queue.splice(0, 50)
      const { error } = await supabase.from('analytics_events').insert(
        batch.map(e => ({
          event_name: e.event_name,
          properties: e.properties,
          device_id: e.device_id,
          session_id: e.session_id,
          timestamp: e.timestamp,
          device_created_tstamp: e.device_created_tstamp,
          device_sent_tstamp: sentAt,
          device_local_tstamp: e.device_local_tstamp,
          timezone: e.timezone,
          app_version: '1.0.0',
          platform: 'pwa',
        }))
      )

      if (error) {
        // Put back on failure
        const current = getQueue()
        saveQueue([...batch, ...current])
      } else {
        saveQueue(queue)
      }
    } catch {
      // network/client error, retain queue
    }
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void analytics.flush()
  })
  ;(window as unknown as Record<string, unknown>).analytics = analytics
}
