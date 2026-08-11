import React, { useContext, useEffect, useRef, useState } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { getActiveRun, getRun, createQuickStartRun, createRunFromTemplate, updateRun, getRunDrills, getRunSwimmerLinks, getRunSwimmers } from '../api/runs'
import { listAllSessions } from '../api/sessions'
import { buildStartLanes } from '../api/runSetup'
import type { Session } from '../api/sessions'
import type { SessionRun } from '../api/runs'
import { ActiveRunView } from './live/ActiveRunView'
import { Icon } from '../components/Icon'

export const LiveDeck: React.FC = () => {
  const { dispatch } = useContext(LiveSessionContext)
  const [activeRun, setActiveRun] = useState<SessionRun | null>(null)
  const [checking, setChecking] = useState(true)
  const [sessionChoices, setSessionChoices] = useState<Session[] | null>(null)
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null)

  const QUICK_START_DEFAULT_SESSION_NAME = 'Quick 100m freestyle (default)'

  const handleStartSession = async (session: Session) => {
    setStartingSessionId(session.id)
    try {
      const runId = await createRunFromTemplate(session.id, {
        date: new Date().toISOString().split('T')[0],
        poolName: 'Live',
      })
      const run = await getRun(runId)
      const { groups, virtualSwimmers } = await buildStartLanes(null, { prefillTempSwimmers: false })
      const notes = { isQuickStart: false, version: 2, virtualSwimmers }
      await updateRun(runId, { notes: JSON.stringify(notes) })
      dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId } })
      setActiveRun(run ?? null)
    } finally {
      setStartingSessionId(null)
    }
  }

  const handleQuickStart = async () => {
    const { runId, drillId } = await createQuickStartRun()
    const { groups, virtualSwimmers } = await buildStartLanes(drillId, { prefillTempSwimmers: true })
    const notes = { isQuickStart: true, version: 2, virtualSwimmers }
    await updateRun(runId, { notes: JSON.stringify(notes) })
    dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId } })
    const run = await getActiveRun()
    setActiveRun(run ?? null)
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const run = (await getActiveRun()) ?? null
      if (cancelled) return
      if (run) {
        setActiveRun(run)
        const notes = run.notes ? (JSON.parse(run.notes) as { isQuickStart?: boolean; virtualSwimmers?: { name: string; dbId: string; lane: number }[] } | null) : null
        if (notes?.virtualSwimmers && notes.virtualSwimmers.length > 0) {
          const drills = await getRunDrills(run.id)
          const defaultDrillId = drills[0]?.id ?? null
          const links = await getRunSwimmerLinks(run.id)
          const allSwimmers = await getRunSwimmers(run.id)
          if (cancelled) return
          const swimmerMap = new Map(allSwimmers.map(s => [s.id, s]))
          const laneMap = new Map<number, TimedGroup>()
          const groups: TimedGroup[] = []
          for (const vs of notes.virtualSwimmers) {
            let g = laneMap.get(vs.lane)
            if (!g) {
              g = {
                id: crypto.randomUUID(),
                lane: vs.lane,
                name: `Lane ${vs.lane}`,
                swimmers: [],
                currentRunDrillId: defaultDrillId,
              }
              laneMap.set(vs.lane, g)
              groups.push(g)
            }
            g.swimmers.push({
              id: Date.now() + Math.random(),
              dbId: vs.dbId,
              name: vs.name,
              completed: false,
              lapStrokeCounts: {},
            })
          }
          for (const link of links) {
            let g = laneMap.get(link.lane)
            if (!g) {
              g = {
                id: crypto.randomUUID(),
                lane: link.lane,
                name: `Lane ${link.lane}`,
                swimmers: [],
                currentRunDrillId: defaultDrillId,
              }
              laneMap.set(link.lane, g)
              groups.push(g)
            }
            if (!g.swimmers.some(s => s.dbId === link.swimmer_id)) {
              const sw = swimmerMap.get(link.swimmer_id)
              g.swimmers.push({
                id: Date.now() + Math.random(),
                dbId: link.swimmer_id,
                name: sw?.name || 'Unknown',
                completed: false,
                lapStrokeCounts: {},
              })
            }
          }
          dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId: run.id } })
        } else {
          const links = await getRunSwimmerLinks(run.id)
          const allSwimmers = await getRunSwimmers(run.id)
          if (cancelled) return
          const swimmerMap = new Map(allSwimmers.map(s => [s.id, s]))
          const maxLane = links.length > 0 ? Math.max(...links.map(l => l.lane)) : 2
          const groups: TimedGroup[] = Array.from({ length: maxLane }, (_, i) => {
            const laneNum = i + 1
            const laneLinks = links.filter(l => l.lane === laneNum)
            return {
              id: crypto.randomUUID(),
              lane: laneNum,
              name: `Lane ${laneNum}`,
              swimmers: laneLinks.map((link, idx) => {
                const sw = swimmerMap.get(link.swimmer_id)
                return {
                  id: Date.now() + idx + Math.random(),
                  dbId: link.swimmer_id,
                  name: sw?.name || 'Unknown',
                  completed: false,
                  lapStrokeCounts: {},
                }
              }),
              currentRunDrillId: null,
            }
          })
          dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId: run.id } })
        }
      }
      if (!cancelled) setChecking(false)
    }
    void init()
    return () => { cancelled = true }
  }, [dispatch])

  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (!checking || activeRun || autoStartedRef.current) return
    autoStartedRef.current = true
    const init = async () => {
      try {
        const sessions = await listAllSessions()
        if (sessions.length === 0) {
          await handleQuickStart()
        } else if (sessions.length === 1) {
          const only = sessions[0]
          if (only.name === QUICK_START_DEFAULT_SESSION_NAME) {
            await handleQuickStart()
          } else {
            await handleStartSession(only)
          }
        } else {
          setSessionChoices(sessions)
        }
      } catch {
        await handleQuickStart()
      }
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, activeRun])

  if (checking) return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">Loading...</p></div>

  if (activeRun) {
    return <ActiveRunView run={activeRun} onComplete={() => { dispatch({ type: 'CLEAR' }); setActiveRun(null); autoStartedRef.current = false }} />
  }

  if (sessionChoices && sessionChoices.length > 1) {
    return (
      <div className="max-w-2xl mx-auto py-8 md:py-12">
        <div className="text-center mb-8">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface m-0">Start a Session</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Choose a template to begin a live timing session.</p>
        </div>
        <div className="space-y-3">
          {sessionChoices.map(s => (
            <button
              key={s.id}
              onClick={() => handleStartSession(s)}
              disabled={startingSessionId !== null}
              className="w-full flex items-center justify-between gap-3 p-4 md:p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant hover:border-primary/40 transition-all text-left cursor-pointer shadow-sm disabled:opacity-60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon name="pool" color="primary" />
                <div className="min-w-0">
                  <span className="block font-bold text-on-surface truncate">{s.name}</span>
                </div>
              </div>
              <span className="flex items-center gap-1 text-primary font-bold text-sm shrink-0">
                {startingSessionId === s.id ? 'Starting...' : 'Start'}
                <Icon name="arrow_forward" size="md" />
              </span>
            </button>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={handleQuickStart}
            disabled={startingSessionId !== null}
            className="text-sm text-primary font-bold hover:underline cursor-pointer bg-transparent border-none disabled:opacity-60"
          >
            or quick-start the default 100m freestyle
          </button>
        </div>
      </div>
    )
  }

  return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">Starting timer...</p></div>
}