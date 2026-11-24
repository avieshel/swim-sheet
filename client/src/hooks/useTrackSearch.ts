import { useEffect, useRef } from 'react'
import { ANALYTICS_SEARCH_DEBOUNCE_MS, Events, analytics } from '../services/analyticsEvents'

type SearchScope = 'swimmers' | 'sessions' | 'drills' | 'runs'

export function useTrackSearch(scope: SearchScope, signature: string, resultCount: number | null) {
  const lastTrackedRef = useRef('')

  useEffect(() => {
    if (!signature || resultCount === null) {
      lastTrackedRef.current = ''
      return
    }
    if (signature === lastTrackedRef.current) return
    const timer = setTimeout(() => {
      lastTrackedRef.current = signature
      analytics.track(Events.SearchPerformed(scope, resultCount))
    }, ANALYTICS_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [scope, signature, resultCount])
}
