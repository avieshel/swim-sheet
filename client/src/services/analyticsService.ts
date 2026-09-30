import { supabase } from '../api/supabase'

const DEVICE_ID_KEY = 'swimsheet_device_id'
const ANALYTICS_QUEUE_KEY = 'swimsheet_analytics_queue'

interface AnalyticsEvent {
  event_name: string
  properties: Record<string, unknown>
  device_id: string
  timestamp: string
}

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return 'anonymous-device'
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
      const event: AnalyticsEvent = {
        event_name: eventName,
        properties,
        device_id: getDeviceId(),
        timestamp: new Date().toISOString(),
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

    try {
      // Send batch to Supabase analytics_events table
      const batch = queue.splice(0, 50)
      const { error } = await supabase.from('analytics_events').insert(
        batch.map(e => ({
          event_name: e.event_name,
          properties: e.properties,
          device_id: e.device_id,
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
