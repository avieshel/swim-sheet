import React, { useReducer, useEffect } from 'react'
import type { ReactNode } from 'react'
import { LiveSessionContext, initialState, liveSessionReducer } from './LiveSessionContext'
import type { TimedGroup } from './LiveSessionContext'

export const LiveSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(liveSessionReducer, initialState)

  useEffect(() => {
    if (state.groups.length === 0 && !state.runId) {
      const groups: TimedGroup[] = Array.from({ length: 8 }, (_, i) => ({
        id: crypto.randomUUID(),
        lane: i + 1,
        name: `Lane ${i + 1}`,
        swimmers: [],
        elapsed: 0,
        running: false,
        currentRunDrillId: null,
        drillOverride: null,
      }))
      dispatch({ type: 'ADD_GROUPS', payload: groups })
    }
  }, [state.groups.length, state.runId, dispatch])

  return (
    <LiveSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </LiveSessionContext.Provider>
  )
}