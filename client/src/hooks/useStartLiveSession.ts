import { useContext, useState } from 'react'
import { LiveSessionContext } from '../context/LiveSessionContext'
import { createRunFromTemplate, updateRun, getRun } from '../api/runs'
import { buildStartLanes } from '../api/runSetup'
import type { Session } from '../api/sessions'

export const DEFAULT_QUICK_SESSION_NAME = 'Quick 100m freestyle (default)'

// One shared "start a live session from a template" flow, used by both the Live
// picker and the Sessions view so every entry point behaves identically: create
// the run, open 2 empty lanes (the default quick-time template pre-fills temp
// swimmers while the roster is empty), then hand the deck to the active run.
export function useStartLiveSession(): {
  startLiveSession: (session: Session) => Promise<import('../api/runs').SessionRun | undefined>
  starting: boolean
} {
  const { dispatch } = useContext(LiveSessionContext)
  const [starting, setStarting] = useState(false)

  const startLiveSession = async (session: Session): Promise<import('../api/runs').SessionRun | undefined> => {
    setStarting(true)
    try {
      const runId = await createRunFromTemplate(session.id, {
        date: new Date().toISOString().split('T')[0],
        poolName: 'Live',
      })
      const prefillTempSwimmers = session.name === DEFAULT_QUICK_SESSION_NAME
      const { groups, virtualSwimmers } = await buildStartLanes(null, { prefillTempSwimmers })
      const notes = { isQuickStart: false, version: 2, virtualSwimmers }
      await updateRun(runId, { notes: JSON.stringify(notes) })
      dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId } })
      return getRun(runId)
    } finally {
      setStarting(false)
    }
  }

  return { startLiveSession, starting }
}
