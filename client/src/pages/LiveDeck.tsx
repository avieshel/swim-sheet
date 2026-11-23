import React, { useContext, useEffect, useState } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { getActiveRun, getRun, createQuickStartRun, updateRun, getRunDrills, getRunSwimmerLinks, getRunSwimmers } from '../api/runs'
import { listSessionsByUsage } from '../api/sessions'
import { buildStartLanes } from '../api/runSetup'
import type { Session } from '../api/sessions'
import type { SessionRun } from '../api/runs'
import { ActiveRunView } from './live/ActiveRunView'
import { Icon } from '../components/Icon'
import { useI18n } from '../i18n'
import { useStartLiveSession, DEFAULT_QUICK_SESSION_NAME } from '../hooks/useStartLiveSession'
import { Events, analytics } from '../services/analyticsEvents'

export const LiveDeck: React.FC = () => {
  const { t } = useI18n()
  const { dispatch } = useContext(LiveSessionContext)
  const { startLiveSession } = useStartLiveSession()
  const [activeRun, setActiveRun] = useState<SessionRun | null>(null)
  const [checking, setChecking] = useState(true)
  const [sessionChoices, setSessionChoices] = useState<Session[] | null>(null)
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null)
  const [startingQuickStart, setStartingQuickStart] = useState(false)
  const [showTempSwimmersNotice, setShowTempSwimmersNotice] = useState(false)

  const handleStartSession = async (session: Session) => {
    setStartingSessionId(session.id)
    try {
      const run = await startLiveSession(session)
      setActiveRun(run ?? null)
    } finally {
      setStartingSessionId(null)
    }
  }

  const handleQuickStart = async () => {
    setStartingQuickStart(true)
    try {
      const { runId, drillId } = await createQuickStartRun()
      const { groups, virtualSwimmers } = await buildStartLanes(drillId, { prefillTempSwimmers: true })
      analytics.track(Events.QuickTimeStarted(virtualSwimmers.length))
      const notes = { isQuickStart: true, version: 2, virtualSwimmers }
      await updateRun(runId, { notes: JSON.stringify(notes) })
      dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId } })
      const run = await getRun(runId)
      setActiveRun(run ?? null)
      setShowTempSwimmersNotice(virtualSwimmers.length > 0)
    } finally {
      setStartingQuickStart(false)
    }
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
                name: t('live.lane', { lane: vs.lane }),
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
                name: t('live.lane', { lane: link.lane }),
                swimmers: [],
                currentRunDrillId: defaultDrillId,
              }
              laneMap.set(link.lane, g)
              groups.push(g)
            }
            if (!g.swimmers.some(s => s.dbId === link.swimmerId)) {
              const sw = swimmerMap.get(link.swimmerId)
              g.swimmers.push({
                id: Date.now() + Math.random(),
                dbId: link.swimmerId,
                name: sw?.name || t('live.unknownSwimmer'),
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
              name: t('live.lane', { lane: laneNum }),
              swimmers: laneLinks.map((link, idx) => {
                const sw = swimmerMap.get(link.swimmerId)
                return {
                  id: Date.now() + idx + Math.random(),
                  dbId: link.swimmerId,
                  name: sw?.name || t('live.unknownSwimmer'),
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
  }, [dispatch, t])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const sessions = (await listSessionsByUsage()).filter(s => s.name !== DEFAULT_QUICK_SESSION_NAME)
        if (!cancelled) setSessionChoices(sessions)
      } catch {
        if (!cancelled) setSessionChoices([])
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  if (checking) return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">{t('live.loading')}</p></div>

  if (activeRun) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <ActiveRunView run={activeRun} onComplete={() => { dispatch({ type: 'CLEAR' }); setActiveRun(null) }} />
        {showTempSwimmersNotice && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl p-4 md:p-6 shadow-2xl text-center">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-primary-container">
                <Icon name="info" size="xl" color="primary" className="md:text-3xl" />
              </div>
              <h3 className="font-headline-md text-on-surface mb-2">{t('live.tempSwimmers.title')}</h3>
              <p className="font-body-md text-on-surface-variant mb-4">
                {t('live.tempSwimmers.message')}
              </p>
              <button
                type="button"
                onClick={() => setShowTempSwimmersNotice(false)}
                className="w-full h-12 min-w-[44px] bg-primary text-on-primary rounded-xl font-label-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                {t('live.tempSwimmers.gotIt')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 md:py-12">
      <div className="text-center mb-8">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface m-0">{t('live.start.title')}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-2">{t('live.start.subtitle')}</p>
      </div>
      <div className="space-y-3">
        <button
          onClick={handleQuickStart}
          disabled={startingQuickStart}
          className="w-full flex items-center justify-between gap-3 p-4 md:p-5 bg-surface-container-lowest rounded-2xl border-2 border-primary/40 hover:border-primary transition-all text-start cursor-pointer shadow-sm disabled:opacity-60"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
              <Icon name="timer" color="primary" />
            </div>
            <div className="min-w-0">
              <span className="block font-bold text-on-surface truncate">{t('live.start.quickTimeLabel')}</span>
              <span className="block text-label-sm text-on-surface-variant">{t('live.start.quickTimeDesc')}</span>
            </div>
          </div>
          <Icon name="arrow_forward" size="md" color="primary" />
        </button>

        {sessionChoices === null && (
          <div className="h-12 bg-surface-container-lowest rounded-2xl animate-pulse" />
        )}

        {sessionChoices?.map(s => (
          <button
            key={s.id}
            onClick={() => handleStartSession(s)}
            disabled={startingSessionId !== null}
            className="w-full flex items-center justify-between gap-3 p-4 md:p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant hover:border-primary/40 transition-all text-start cursor-pointer shadow-sm disabled:opacity-60"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0">
                <Icon name="pool" color="primary" />
              </div>
              <div className="min-w-0">
                <span className="block font-bold text-on-surface truncate">{s.name}</span>
              </div>
            </div>
            {startingSessionId === s.id ? (
              <span className="text-label-sm text-on-surface-variant shrink-0">{t('live.start.starting')}</span>
            ) : (
              <Icon name="arrow_forward" size="md" color="primary" />
            )}
          </button>
        ))}

        {sessionChoices !== null && sessionChoices.length === 0 && (
          <p className="text-center text-label-sm text-on-surface-variant pt-2">{t('live.start.noTemplates')}</p>
        )}
      </div>
    </div>
  )
}
