import React, { useContext, useEffect, useRef, useState } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import { EquipmentIcons, type EquipmentType } from '../components/EquipmentIcons'
import { listSwimmers } from '../api/swimmers'
import { listSessions, getSession } from '../api/sessions'
import { getActiveRun, createRunFromTemplate, completeRun, addSwimmerToRun, getRunDrills, getLaneResults, addLap, removeSwimmerFromRun, setLaneResult, deleteLaneResult, deleteLaneResultsForGroup, deleteLaneResultsForRun, clearSwimmerFromLaneResult, getLaneResult, getRunSwimmers, getRunSwimmerLinks } from '../api/runs'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Session } from '../api/sessions'
import type { SessionRun, RunDrill, LaneDrillResult, Swimmer as DbSwimmer } from '../api/runs'
import { removeLap, laneRelativeToSplits } from '../utils/lapEditing'
import { formatTime } from '../utils/formatTime'
import { LapTimeline } from '../components/LapTimeline'
import { LaneEditorModal } from '../components/LaneEditorModal'

interface SavedSwimmerData {
  dbId: string
  name: string
  offsetFromLaneStart: number | null
  finalElapsed: number | null
  laps: number[]
  completed: boolean
  strokeCount: number | null
}

interface SavedDrillData {
  laneElapsed: number
  swimmers: SavedSwimmerData[]
}

// ── Setup Mode ─────────────────────────────────────────────

function SessionSetup({ onStart }: { onStart: () => void }) {
const [templates, setTemplates] = useState<Session[]>([])
   const [selectedTemplateId, setSelectedTemplateId] = useState('')
   const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
   const [formPoolName, setFormPoolName] = useState('')
   const [formPoolLength, setFormPoolLength] = useState('25')
   const [poolLengthOption, setPoolLengthOption] = useState<'25' | '50' | 'custom'>('25')
   const [customPoolLength, setCustomPoolLength] = useState('')
   const [allSwimmers, setAllSwimmers] = useState<DbSwimmer[]>([])
   const [assignments, setAssignments] = useState<Record<string, number>>({}) // swimmerId → lane
   const [loading, setLoading] = useState(true)
   const [laneCount, setLaneCount] = useState(8)

  useEffect(() => {
    Promise.all([listSessions(), listSwimmers()]).then(([sessions, swimmers]) => {
      setTemplates(sessions)
      setAllSwimmers(swimmers)
      setLoading(false)
    })
  }, [])

const handleTemplateSelect = async (id: string) => {
     setSelectedTemplateId(id)
      const session = await getSession(id)
     if (session) {
       const length = String(session.poolLength)
       setFormPoolLength(length)
       if (length === '25') {
         setPoolLengthOption('25')
       } else if (length === '50') {
         setPoolLengthOption('50')
       } else {
         setPoolLengthOption('custom')
         setCustomPoolLength(length)
       }
     }
   }

  const toggleSwimmer = (swimmerId: string, lane: number) => {
    setAssignments(prev => {
      const next = { ...prev }
      if (next[swimmerId] === lane) {
        delete next[swimmerId]
      } else {
        next[swimmerId] = lane
      }
      return next
    })
  }

  const handleStart = async () => {
    if (!selectedTemplateId) return
    // Clear any existing active run first
    const existing = await getActiveRun()
    if (existing) await completeRun(existing.id)

    const runId = await createRunFromTemplate(selectedTemplateId, {
      date: formDate,
      poolName: formPoolName || 'Unnamed Pool',
      poolLength: Number(formPoolLength) || 25,
    })

    for (const [swimmerId, lane] of Object.entries(assignments)) {
      await addSwimmerToRun(runId, swimmerId, lane)
    }

    onStart()
  }

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">Loading...</p></div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="material-symbols-outlined text-5xl text-primary mb-2">timer</span>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Start a Session</h2>
        <p className="text-on-surface-variant mt-1">Choose a template, configure the pool, and assign swimmers to lanes.</p>
      </div>

      {/* Template Picker */}
      <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant mb-4">
        <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">Session Template</label>
        {templates.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No templates yet. Create one in the Sessions page first.</p>
        ) : (
          <div className="r-grid" style={{ '--grid-min': '200px', '--grid-gap': '0.5rem' } as React.CSSProperties}>
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleTemplateSelect(t.id)}
                className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedTemplateId === t.id
                    ? 'border-primary bg-primary-container/20'
                    : 'border-outline-variant hover:border-primary/50 bg-surface-container-low'
                }`}
              >
                <span className="font-bold text-on-surface block">{t.name}</span>
                <span className="text-label-sm text-on-surface-variant">{t.poolLength}m default pool</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Run Config */}
      <div className="bg-surface-container-lowest rounded-xl p-4 md:p-5 border border-outline-variant mb-4">
        <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Session Details</h3>
        <div className="r-grid" style={{ '--grid-min': '180px', '--grid-gap': 'clamp(0.5rem, 2vw, 1rem)' } as React.CSSProperties}>
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Date</label>
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
            />
          </div>
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Pool Name</label>
            <input
              type="text"
              value={formPoolName}
              onChange={e => setFormPoolName(e.target.value)}
              placeholder="e.g. Olympic Pool"
              className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
            />
          </div>
<div>
             <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Pool Length (m)</label>
             <select
               value={poolLengthOption}
                onChange={e => {
                  setPoolLengthOption(e.target.value as "25" | "50" | "custom");
                  if (e.target.value !== 'custom') {
                    setFormPoolLength(e.target.value);
                    setCustomPoolLength('');
                 }
               }}
               className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
             >
               <option value="25">25m (default)</option>
               <option value="50">50m</option>
               <option value="custom">Custom</option>
             </select>
{poolLengthOption === 'custom' && (
                <input
                  type="number"
                  value={customPoolLength}
                  onChange={e => {
                    setCustomPoolLength(e.target.value);
                    setFormPoolLength(e.target.value);
                  }}
                  placeholder="Enter length (m)"
                  className="w-full mt-2 bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
                />
              )}
           </div>
        </div>
      </div>

      {/* Swimmer Assignment */}
      <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant mb-6">
        <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Assign Swimmers to Lanes</h3>
        {allSwimmers.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No swimmers in the roster. Add swimmers first.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allSwimmers.map(sw => (
              <div key={sw.id} className="flex items-center justify-between p-2 bg-surface-container-low rounded-lg">
                <span className="font-body-md text-body-md text-on-surface">{sw.name}</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {Array.from({ length: laneCount }, (_, i) => i + 1).map(lane => (
                    <button
                      key={lane}
                      onClick={() => toggleSwimmer(sw.id, lane)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        assignments[sw.id] === lane
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-highest text-on-surface-variant hover:bg-primary-container/30'
                      }`}
                    >
                      {lane}
                    </button>
                  ))}
                  <button
                    onClick={() => setLaneCount(laneCount + 1)}
                    className="w-8 h-8 rounded-lg text-xs font-bold bg-surface-container-highest text-on-surface-variant hover:bg-primary-container/30 transition-all cursor-pointer border border-dashed border-outline-variant flex items-center justify-center"
                    title="Add lane"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {Object.keys(assignments).length > 0 && (
          <p className="text-label-sm text-on-surface-variant mt-2">{Object.keys(assignments).length} swimmers assigned</p>
        )}
      </div>

      <button
        onClick={handleStart}
        disabled={!selectedTemplateId}
        className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-primary/20"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
        Start Session
      </button>
    </div>
  )
}

// ── Active Run Mode ────────────────────────────────────────

function GroupCard({ group, runDrills, laneDrillResults, poolLength, laneCount, onAddSwimmer, onCompleteDrill, onResetDrill, onResetGroup, onClearSwimmer, onEditSavedSwimmer }: {
  group: TimedGroup;
  runDrills: RunDrill[];
  laneDrillResults: LaneDrillResult[];
  poolLength: number;
  laneCount: number;
  onAddSwimmer: (groupId: string) => void;
  onCompleteDrill: (groupId: string) => void;
  onResetDrill: (groupId: string) => void;
  onResetGroup: (groupId: string) => void;
  onClearSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string) => void;
  onEditSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: number[]; offsetFromLaneStart?: number; finalElapsed?: number }) => void;
}) {
  const getLaneLabel = (lane: number) => {
    if (lane === 1) return 'FAST'
    if (lane === 4) return 'MID'
    if (lane === 5) return 'SLOW'
    return 'MID'
  }
  const { dispatch } = useContext(LiveSessionContext)
  const [editingDistance, setEditingDistance] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showResetGroupConfirm, setShowResetGroupConfirm] = useState(false)
  const [confirmClearSwimmer, setConfirmClearSwimmer] = useState<{ swimmerId: number; dbId?: string } | null>(null)
  const [lapEditMode, setLapEditMode] = useState<Record<string, boolean>>({})
  const [isEditingConfig, setIsEditingConfig] = useState(false)
  const [tempName, setTempName] = useState(group.name)
  const [tempLane, setTempLane] = useState(group.lane)

  const toggleLapEdit = (key: string) => setLapEditMode(prev => ({ ...prev, [key]: !prev[key] }))

  // Responsive sizing — single fluid values work at any card width
  const narrowCard = laneCount >= 3

  const currentDrillIndex = runDrills.findIndex(d => d.id === group.currentRunDrillId)
  const baseDrill = runDrills.find(d => d.id === group.currentRunDrillId)
  const effectiveDistance = group.drillOverride?.distance ?? baseDrill?.distance ?? 0
  const effectiveStroke = group.drillOverride?.stroke ?? baseDrill?.stroke ?? ''
  const laneResult = group.currentRunDrillId ? laneDrillResults.find(r => r.group_id === group.id && r.run_drill_id === group.currentRunDrillId) : null
  const isCompletedDrill = laneResult?.completed === true
  const savedData: SavedDrillData | null = isCompletedDrill && laneResult?.data ? JSON.parse(laneResult.data) : null

  const nextDrill = currentDrillIndex >= 0 && currentDrillIndex < runDrills.length - 1
    ? runDrills[currentDrillIndex + 1]
    : null

  const handleMoveSwimmer = (swimmerId: number, direction: 'up' | 'down') => {
    const idx = group.swimmers.findIndex(s => s.id === swimmerId)
    if (idx === -1) return
    const newIds = group.swimmers.map(s => s.id)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newIds.length) return
    ;[newIds[idx], newIds[targetIdx]] = [newIds[targetIdx], newIds[idx]]
    dispatch({ type: 'REORDER_SWIMMERS', payload: { groupId: group.id, swimmerIds: newIds } })
  }

  const autoSavedRef = useRef(false)

  // Auto-save and advance when all swimmers are done
  useEffect(() => {
    autoSavedRef.current = false
  }, [group.currentRunDrillId])

  useEffect(() => {
    if (!group.currentRunDrillId) return
    if (isCompletedDrill) return
    if (group.swimmers.length === 0) return
    if (autoSavedRef.current) return
    if (group.swimmers.every(s => s.completed)) {
      autoSavedRef.current = true
      onCompleteDrill(group.id)
    }
  }, [group.swimmers, group.currentRunDrillId, isCompletedDrill])

  const handleOverrideDistance = () => {
    const d = parseInt(editValue, 10)
    if (!isNaN(d) && d > 0) {
      dispatch({ type: 'SET_GROUP_DRILL_OVERRIDE', payload: { groupId: group.id, override: { ...group.drillOverride || {}, distance: d } } })
    }
    setEditingDistance(false)
  }

  const clearOverride = () => {
    dispatch({ type: 'CLEAR_GROUP_DRILL_OVERRIDE', payload: { groupId: group.id } })
  }

  const handleSaveConfig = () => {
    dispatch({ type: 'UPDATE_GROUP_CONFIG', payload: { groupId: group.id, updates: { name: tempName, lane: tempLane } } })
    setIsEditingConfig(false)
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }

  const swimmerElapsed = (laneElapsed: number, swimmer: { offsetFromLaneStart: number | null }) => {
    return swimmer.offsetFromLaneStart !== null ? laneElapsed - swimmer.offsetFromLaneStart : 0
  }

  return (
    <div className={`glass-panel rounded-2xl p-3 sm:p-4 lg:p-5 transition-all bg-surface-container-lowest border ${isCompletedDrill ? 'border-emerald-500/30' : group.running ? 'border-primary shadow-lg shadow-primary/10' : 'border-outline-variant'}`}>
      {/* Group Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          {isEditingConfig ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={tempName}
                onChange={e => setTempName(e.target.value)}
                className="w-32 bg-surface-container-low border-b-2 border-primary p-1 text-sm font-bold outline-none rounded-t-lg"
                autoFocus
              />
              <span className="text-sm text-on-surface-variant">Lane</span>
              <input
                type="number"
                min={1}
                max={12}
                value={tempLane}
                onChange={e => setTempLane(Number(e.target.value))}
                className="w-14 bg-surface-container-low border-b-2 border-primary p-1 text-sm font-bold outline-none rounded-t-lg text-center"
              />
              <button onClick={handleSaveConfig}
                className="h-7 px-3 rounded-full bg-primary text-on-primary text-xs font-bold cursor-pointer">Save</button>
              <button onClick={() => { setIsEditingConfig(false); setTempName(group.name); setTempLane(group.lane) }}
                className="h-7 px-3 rounded-full border border-outline text-on-surface-variant text-xs cursor-pointer">Cancel</button>
            </div>
          ) : (
            <>
              <span className="font-headline-md lg:font-headline-lg text-primary">{group.name}</span>
              <span className={`px-2 py-0.5 rounded text-label-sm font-bold ${getLaneLabel(group.lane) === 'FAST' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                L{group.lane}
              </span>
              <button onClick={() => { setIsEditingConfig(true); setTempName(group.name); setTempLane(group.lane) }}
                className="h-6 w-6 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all cursor-pointer ml-1">
                <span className="material-symbols-outlined text-xs">edit</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Group-Level Controls + Timer */}
      <div className="mb-4 p-4 rounded-xl bg-surface-container">
        <div className={`flex ${laneCount >= 3 ? 'flex-col items-center gap-2' : 'items-center justify-between gap-3'}`}>
          <div className="font-display-timer text-[clamp(1.5rem,6vw,2.6rem)] text-on-surface tabular-nums tracking-tight">
            {isCompletedDrill ? formatTime(savedData?.laneElapsed ?? 0) : formatTime(group.elapsed)}
          </div>
          {!isCompletedDrill ? (
            <div className={`flex gap-1.5 ${laneCount >= 3 ? 'flex-wrap justify-center' : 'shrink-0'}`}>
              {!group.running ? (
                <button onClick={() => dispatch({ type: 'START_GROUP_TIMER', payload: { groupId: group.id } })}
                  className="flex items-center gap-1 h-10 md:h-11 px-4 md:px-5 rounded-full bg-emerald-600 text-white text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                  Start
                </button>
              ) : (
                <button onClick={() => dispatch({ type: 'PAUSE_GROUP_TIMER', payload: { groupId: group.id } })}
                  className="flex items-center gap-1 h-10 md:h-11 px-4 md:px-5 rounded-full bg-red-600 text-white text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer">
                  <span className="material-symbols-outlined text-base">stop</span>
                  Stop
                </button>
              )}
              {group.running && (
                <button onClick={() => dispatch({ type: 'DRILL_LAP', payload: { groupId: group.id, elapsed: group.elapsed } })}
                  className="flex items-center gap-1 h-10 md:h-11 px-4 md:px-5 rounded-full bg-blue-600 text-white text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer">
                  <span className="material-symbols-outlined text-base">flag</span>
                  Lap
                </button>
              )}
              <button onClick={() => dispatch({ type: 'DRILL_DONE', payload: { groupId: group.id, elapsed: group.elapsed } })}
                className="flex items-center gap-1 h-10 md:h-11 px-4 md:px-5 rounded-full bg-emerald-600 text-white text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer">
                <span className="material-symbols-outlined text-base">flag</span>
                Done
              </button>
              <button onClick={() => setShowResetConfirm(true)}
                className="h-10 w-10 md:h-11 md:w-11 rounded-full border-2 border-outline flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-all cursor-pointer">
                <span className="material-symbols-outlined text-base">refresh</span>
              </button>
            </div>
          ) : (
            <button onClick={() => onResetDrill(group.id)}
              className="h-10 md:h-11 px-4 md:px-5 rounded-full border-2 border-outline text-sm font-bold text-on-surface-variant hover:bg-surface-variant transition-all cursor-pointer shrink-0">
              Re-open
            </button>
          )}
        </div>
      </div>

      {/* Current Drill — or drill picker if none selected */}
      {currentDrillIndex >= 0 ? (
        <div className={`mb-3 p-4 rounded-xl border ${isCompletedDrill ? 'bg-emerald-50 border-emerald-200' : 'bg-surface-container-low border-outline-variant/20'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-0.5">
                Drill {currentDrillIndex + 1} of {runDrills.length}
                {isCompletedDrill && <span className="ml-2 text-emerald-600 font-bold flex items-center gap-0.5"><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Complete</span>}
              </div>
              <div className="font-bold text-on-surface text-sm md:text-base truncate">{baseDrill?.name}</div>
              <div className="text-sm text-on-surface-variant flex items-center gap-2 flex-wrap">
                <span>{effectiveDistance}m {effectiveStroke}</span>
                {baseDrill?.interval && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider">
                    @ {baseDrill.interval}
                  </span>
                )}
                {baseDrill?.equipment && baseDrill.equipment.length > 0 && (
                  <span className="flex items-center gap-1">
                    {baseDrill.equipment.map(e => (
                      <EquipmentIcons key={e} type={e as EquipmentType} className="w-4 h-4 text-orange-600" />
                    ))}
                  </span>
                )}
                {baseDrill?.instructions && !baseDrill.instructions.includes('\n') && (
                  <span className="px-1.5 py-0.5 bg-primary-container text-on-primary-container text-[10px] font-bold rounded uppercase tracking-wider">
                    {baseDrill.instructions}
                  </span>
                )}
              </div>
              {baseDrill?.instructions && baseDrill.instructions.includes('\n') && (
                <div className="mt-2 p-2 bg-surface-container-lowest/50 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed border border-outline-variant/30 text-on-surface">
                  {baseDrill.instructions}
                </div>
              )}
              {baseDrill?.notes && (
                <div className="mt-2 text-[11px] text-on-surface-variant italic border-l-2 border-outline-variant/30 pl-2">
                  {baseDrill.notes}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0 items-start">
              <button onClick={() => { const prev = runDrills[currentDrillIndex - 1]; if (prev) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: prev.id, autoStart: prev.tag !== 'warmup' && prev.tag !== 'cooldown' } }) }}
                disabled={currentDrillIndex <= 0}
                className="h-8 w-8 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/40 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <button onClick={() => { const next = runDrills[currentDrillIndex + 1]; if (next) dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: next.id, autoStart: next.tag !== 'warmup' && next.tag !== 'cooldown' } }) }}
                disabled={currentDrillIndex < 0 || currentDrillIndex >= runDrills.length - 1}
                className="h-8 w-8 rounded-full bg-primary text-on-primary flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-sm text-on-surface font-bold">{effectiveDistance}m</span>
            <span className="text-sm text-on-surface-variant">{effectiveStroke}</span>
            {group.drillOverride ? (
              <span className="text-[11px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded font-bold">edited</span>
            ) : null}
            <button
              onClick={() => { setEditValue(String(effectiveDistance)); setEditingDistance(true) }}
              className="ml-auto text-xs text-primary font-semibold hover:underline cursor-pointer">edit</button>
            {group.drillOverride && (
              <button onClick={clearOverride} className="text-xs text-error font-semibold hover:underline cursor-pointer">reset</button>
            )}
          </div>
          {editingDistance && (
            <div className="flex gap-1.5 mt-2">
              <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                className="w-24 bg-surface-container-low border-b-2 border-outline focus:border-primary p-1.5 text-sm outline-none rounded-t-lg" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleOverrideDistance(); if (e.key === 'Escape') setEditingDistance(false) }} />
              <button onClick={handleOverrideDistance} className="text-sm bg-primary text-on-primary px-3 py-1 rounded-full font-semibold cursor-pointer">set</button>
              <button onClick={() => setEditingDistance(false)} className="text-sm text-on-surface-variant px-2 py-1 cursor-pointer">cancel</button>
            </div>
          )}
        </div>
      ) : runDrills.length > 0 ? (
        <div className="mb-3 p-4 rounded-xl border border-dashed border-primary/30 bg-surface-container-low">
          <div className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-2">Select a drill</div>
          <div className="space-y-1">
            {runDrills.map((d, idx) => (
              <button key={d.id} onClick={() => dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: d.id, autoStart: d.tag !== 'warmup' && d.tag !== 'cooldown' } })}
                className="w-full text-left px-3 py-2 rounded-lg text-sm bg-surface-container-lowest hover:bg-primary-container/30 transition-colors cursor-pointer border border-outline-variant/20">
                <span className="tabular-nums font-semibold text-on-surface-variant mr-1.5">{idx + 1}.</span>
                <span className="text-on-surface">{d.name}</span>
                <span className="ml-1.5 text-on-surface-variant">({d.distance}m {d.stroke})</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-3 p-4 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/20 text-center">
          <p className="text-sm text-on-surface-variant">No drills in this session.</p>
        </div>
      )}

      {/* Next Drill Preview */}
      {currentDrillIndex >= 0 && nextDrill && !isCompletedDrill && (
        <div className="mb-3 p-3 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/40">
          <div className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-0.5">Next</div>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-on-surface truncate">{nextDrill.name}</div>
              <div className="text-xs text-on-surface-variant">{nextDrill.distance}m {nextDrill.stroke}</div>
            </div>
            <button onClick={() => dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: nextDrill.id, autoStart: nextDrill.tag !== 'warmup' && nextDrill.tag !== 'cooldown' } })}
              className="h-7 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all cursor-pointer shrink-0 ml-2">
              Go to drill
            </button>
          </div>
        </div>
      )}

      {/* Swimmers */}
      <div className="space-y-2 mb-3">
        {isCompletedDrill && savedData ? (
          savedData.swimmers?.map((saved: SavedSwimmerData, idx: number) => (
            <div key={idx} className="bg-surface-container rounded-xl border border-outline-variant/20">
              <div className="p-3">
                <div className={narrowCard ? 'flex flex-col gap-3' : 'flex gap-3'}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-container-highest border-2 border-emerald-400 flex items-center justify-center shrink-0 relative">
                        <span className="text-[10px] font-bold text-on-surface">{getInitials(saved.name)}</span>
                        {saved.completed && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[10px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-on-surface text-sm md:text-base truncate">{saved.name}</div>
                        <div className="font-display-timer text-lg tabular-nums tracking-tight text-primary">
                          {saved.finalElapsed !== null ? formatTime(saved.finalElapsed) : saved.offsetFromLaneStart !== null ? formatTime(savedData.laneElapsed - saved.offsetFromLaneStart) : '--:--.--'}
                        </div>
                      </div>
                      {saved.completed && (
                        <div className="text-[10px] text-emerald-600 font-semibold whitespace-nowrap">Finished</div>
                      )}
                      <button onClick={() => setConfirmClearSwimmer({ swimmerId: 0, dbId: saved.dbId })}
                        className="h-7 w-7 rounded-full bg-error text-on-error text-[10px] flex items-center justify-center hover:brightness-110 cursor-pointer shrink-0">
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </div>
                  </div>
                  {saved.laps?.length > 0 && (
                    <div className={narrowCard ? 'pt-2 border-t border-outline-variant/30' : 'shrink-0 border-l border-outline-variant/30 pl-3 min-w-[100px]'}>
                      <div className="text-[10px] text-on-surface-variant font-semibold mb-1 flex items-center gap-1">
                        Laps
                        <button onClick={() => toggleLapEdit(`saved-${saved.dbId}`)} className="text-[8px] text-primary hover:underline leading-none">
                          {lapEditMode[`saved-${saved.dbId}`] ? 'done' : 'edit'}
                        </button>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {(() => {
                          const splits = laneRelativeToSplits(saved.laps, saved.offsetFromLaneStart ?? 0)
                          return splits.map((split: number, i: number) => {
                            const prevSplit = i > 0 ? splits[i - 1] : null
                            const diff = prevSplit !== null ? split - prevSplit : null
                            return (
                              <div key={i} className="flex items-center gap-1 text-[11px] font-mono tabular-nums whitespace-nowrap">
                                  {lapEditMode[`saved-${saved.dbId}`] && (
                                  <button
                                    onClick={() => {
                                      const newLaps = removeLap(saved.laps ?? [], i)
                                      const entry = savedData.swimmers.find((s: SavedSwimmerData) => s.dbId === saved.dbId)
                                      if (entry) onEditSavedSwimmer(group.id, group.currentRunDrillId!, entry.dbId, { laps: newLaps })
                                    }}
                                    className="w-3 h-3 rounded-full bg-red-500/70 text-white text-[6px] flex items-center justify-center leading-none hover:bg-red-500 transition-colors shrink-0">✕</button>
                                )}
                                <span className="text-on-surface-variant w-4 text-right">#{i + 1}</span>
                                <span className="text-on-surface font-semibold">{formatTime(split)}</span>
                                {diff !== null && (
                                  <span className={`${diff > 10 ? 'text-red-500' : diff < -10 ? 'text-emerald-500' : 'text-on-surface-variant'}`}>
                                    {diff > 0 ? '+' : ''}{(diff / 1000).toFixed(1)}s
                                  </span>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                <LapTimeline laps={saved.laps ?? []} totalDistance={effectiveDistance} poolLength={poolLength}
                  laneElapsed={savedData.laneElapsed}
                  offsetFromLaneStart={saved.offsetFromLaneStart ?? 0}
                  finalElapsed={saved.finalElapsed}
                  onChange={(newLaps: number[]) => {
                    const entry = savedData.swimmers.find((s: SavedSwimmerData) => s.dbId === saved.dbId)
                    if (entry) onEditSavedSwimmer(group.id, group.currentRunDrillId!, entry.dbId, { laps: newLaps })
                  }}
                  onChangeStartOffset={(newOffset: number) => {
                    const entry = savedData.swimmers.find((s: SavedSwimmerData) => s.dbId === saved.dbId)
                    if (entry) onEditSavedSwimmer(group.id, group.currentRunDrillId!, entry.dbId, { offsetFromLaneStart: newOffset })
                  }}
                  onChangeDoneTime={(newDone: number) => {
                    const entry = savedData.swimmers.find((s: SavedSwimmerData) => s.dbId === saved.dbId)
                    if (entry) {
                      const currentLaps = saved.laps ?? []
                      const newLaps = currentLaps.length > 0 ? [...currentLaps.slice(0, -1), newDone] : [newDone]
                      onEditSavedSwimmer(group.id, group.currentRunDrillId!, entry.dbId, { laps: newLaps, finalElapsed: newDone })
                    }
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          group.swimmers.map((swimmer, idx) => {
          const derivedElapsed = swimmerElapsed(group.elapsed, swimmer)
          const displayTime = swimmer.completed && swimmer.finalElapsed !== null
            ? formatTime(swimmer.finalElapsed)
            : swimmer.offsetFromLaneStart !== null
              ? formatTime(derivedElapsed)
              : '--:--.--'
          return (
            <div key={swimmer.id} className="bg-surface-container rounded-xl border border-outline-variant/20">
              <div className="p-3">
                <div className={narrowCard ? 'flex flex-col gap-3' : 'flex gap-3'}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button onClick={() => handleMoveSwimmer(swimmer.id, 'up')} disabled={idx === 0}
                          className="h-5 w-5 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                          <span className="material-symbols-outlined text-xs">keyboard_arrow_up</span>
                        </button>
                        <button onClick={() => handleMoveSwimmer(swimmer.id, 'down')} disabled={idx >= group.swimmers.length - 1}
                          className="h-5 w-5 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                          <span className="material-symbols-outlined text-xs">keyboard_arrow_down</span>
                        </button>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-container-highest border-2 border-primary flex items-center justify-center shrink-0 relative">
                        <span className="text-[10px] font-bold text-on-surface">{getInitials(swimmer.name)}</span>
                        {swimmer.completed && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[10px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-on-surface text-sm md:text-base truncate">{swimmer.name}</div>
                        <div className="font-display-timer text-lg tabular-nums tracking-tight text-primary">{displayTime}</div>
                      </div>
                      {!swimmer.offsetFromLaneStart && !swimmer.completed && (
                        <button onClick={() => dispatch({ type: 'REMOVE_SWIMMER', payload: { groupId: group.id, swimmerId: swimmer.id } })}
                          className="h-7 w-7 rounded-full bg-error text-on-error flex items-center justify-center hover:brightness-110 cursor-pointer shrink-0">
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {!swimmer.completed && (swimmer.offsetFromLaneStart === null || (swimmer.offsetFromLaneStart === 0 && swimmer.laps.length === 0)) && (
                        <button onClick={() => {
                          if (!group.running) {
                            dispatch({ type: 'START_GROUP_TIMER', payload: { groupId: group.id } })
                          }
                          dispatch({ type: 'SWIMMER_START', payload: { groupId: group.id, swimmerId: swimmer.id, elapsed: group.elapsed } })
                        }}
                          className="flex items-center gap-0.5 h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm rounded-full bg-emerald-600 text-white font-bold hover:brightness-110 cursor-pointer shrink-0">
                          <span className="material-symbols-outlined text-sm">play_arrow</span>
                          <span>Go</span>
                        </button>
                      )}
                      {swimmer.offsetFromLaneStart !== null && !swimmer.completed && (
                        <>
                          <button onClick={() => dispatch({ type: 'SWIMMER_LAP', payload: { groupId: group.id, swimmerId: swimmer.id, elapsed: group.elapsed } })}
                            className="h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm rounded-full bg-blue-600 text-white font-bold hover:brightness-110 cursor-pointer shrink-0">Lap</button>
                          <button onClick={() => { const count = prompt('Stroke count', '14'); if (count !== null) { const n = parseInt(count, 10); if (!isNaN(n)) dispatch({ type: 'SWIMMER_STROKE_COUNT', payload: { groupId: group.id, swimmerId: swimmer.id, count: n } }) } }}
                            className="h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm rounded-full bg-orange-500 text-white font-bold hover:brightness-110 cursor-pointer shrink-0">SC</button>
                          <button onClick={() => dispatch({ type: 'SWIMMER_COMPLETE', payload: { groupId: group.id, swimmerId: swimmer.id, elapsed: group.elapsed } })}
                            className="h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm rounded-full bg-emerald-600 text-white font-bold hover:brightness-110 cursor-pointer shrink-0 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-sm">flag</span>
                            <span>Done</span>
                          </button>
                        </>
                      )}
                      {(swimmer.offsetFromLaneStart !== null || swimmer.completed) && (
                        <button onClick={() => setConfirmClearSwimmer({ swimmerId: swimmer.id, dbId: swimmer.dbId })}
                          className="h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm rounded-full border-2 border-outline text-on-surface-variant font-bold hover:bg-surface-variant transition-all cursor-pointer shrink-0">
                          Reset
                        </button>
                      )}
                    </div>
                    {swimmer.offsetFromLaneStart !== null && swimmer.offsetFromLaneStart > 0 && (
                      <div className="mt-1 text-[10px] text-on-surface-variant">
                        Offset: +{formatTime(swimmer.offsetFromLaneStart)}
                      </div>
                    )}
                  </div>
                  {swimmer.laps.length > 0 && (
                    <div className={narrowCard ? 'pt-2 border-t border-outline-variant/30' : 'shrink-0 border-l border-outline-variant/30 pl-3 min-w-[100px]'}>
                      <div className="text-[10px] text-on-surface-variant font-semibold mb-1 flex items-center gap-1">
                        Laps
                        <button onClick={() => toggleLapEdit(`active-${swimmer.id}`)} className="text-[8px] text-primary hover:underline leading-none">
                          {lapEditMode[`active-${swimmer.id}`] ? 'done' : 'edit'}
                        </button>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {(() => {
                          const splits = laneRelativeToSplits(swimmer.laps, swimmer.offsetFromLaneStart ?? 0)
                          return splits.map((split, i) => {
                            const prevSplit = i > 0 ? splits[i - 1] : null
                            const diff = prevSplit !== null ? split - prevSplit : null
                            return (
                              <div key={i} className="flex items-center gap-1 text-[11px] font-mono tabular-nums whitespace-nowrap">
                                {lapEditMode[`active-${swimmer.id}`] && (
                                  <button
                                    onClick={() => {
                                      const newLaps = removeLap(swimmer.laps, i)
                                      dispatch({ type: 'SWIMMER_SET_LAPS', payload: { groupId: group.id, swimmerId: swimmer.id, laps: newLaps } })
                                    }}
                                    className="w-3 h-3 rounded-full bg-red-500/70 text-white text-[6px] flex items-center justify-center leading-none hover:bg-red-500 transition-colors shrink-0">✕</button>
                                )}
                                <span className="text-on-surface-variant w-4 text-right">#{i + 1}</span>
                                <span className="text-on-surface font-semibold">{formatTime(split)}</span>
                                {diff !== null && (
                                  <span className={`${diff > 10 ? 'text-red-500' : diff < -10 ? 'text-emerald-500' : 'text-on-surface-variant'}`}>
                                    {diff > 0 ? '+' : ''}{(diff / 1000).toFixed(1)}s
                                  </span>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                <LapTimeline laps={swimmer.laps} totalDistance={effectiveDistance} poolLength={poolLength}
                  laneElapsed={group.elapsed}
                  offsetFromLaneStart={swimmer.offsetFromLaneStart ?? 0}
                  finalElapsed={swimmer.finalElapsed}
                  onChange={(newLaps: number[]) => dispatch({ type: 'SWIMMER_SET_LAPS', payload: { groupId: group.id, swimmerId: swimmer.id, laps: newLaps } })}
                  onChangeStartOffset={(newOffset: number) => dispatch({ type: 'SWIMMER_SET_OFFSET', payload: { groupId: group.id, swimmerId: swimmer.id, offsetFromLaneStart: newOffset } })}
                  onChangeDoneTime={(newDone: number) => {
                    const newLaps = [...swimmer.laps.slice(0, -1), newDone]
                    dispatch({ type: 'SWIMMER_SET_LAPS', payload: { groupId: group.id, swimmerId: swimmer.id, laps: newLaps } })
                  }}
                />
              </div>
            </div>
          )
        }))}
      </div>

      {/* Add swimmer + Reset Group */}
      <button onClick={() => onAddSwimmer(group.id)}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-outline-variant flex items-center justify-center gap-1 text-sm text-on-surface-variant hover:text-primary hover:border-primary transition-colors cursor-pointer">
        <span className="material-symbols-outlined text-base">add</span>
        Add Swimmer
      </button>
      <button onClick={() => setShowResetGroupConfirm(true)}
        className="w-full mt-2 py-2.5 rounded-xl border-2 border-error/30 text-error text-sm font-bold flex items-center justify-center gap-1 hover:bg-error/5 transition-colors cursor-pointer">
        <span className="material-symbols-outlined text-base">refresh</span>
        Reset Group
      </button>

      {/* Reset Drill Confirmation Dialog */}
      <ConfirmDialog
        open={showResetConfirm}
        title="Reset drill timing?"
        message={`Clear all timer and lap data for this drill on ${group.name}?`}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={() => {
          onResetDrill(group.id)
          setShowResetConfirm(false)
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Reset Group Confirmation Dialog */}
      <ConfirmDialog
        open={showResetGroupConfirm}
        title="Reset Group?"
        message={`Clear all timing data and return ${group.name} to the first drill? Swimmers will remain assigned.`}
        confirmLabel="Reset Group"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={() => {
          onResetGroup(group.id)
          setShowResetGroupConfirm(false)
        }}
        onCancel={() => setShowResetGroupConfirm(false)}
      />

      {/* Reset Swimmer Confirmation Dialog */}
      <ConfirmDialog
        open={confirmClearSwimmer !== null}
        title="Reset swimmer timing?"
        message="Clear this swimmer's offsets, laps, and timing data for the current drill?"
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={() => {
          if (confirmClearSwimmer) {
            if (group.currentRunDrillId) {
              if (confirmClearSwimmer.swimmerId > 0) {
                dispatch({ type: 'SWIMMER_CLEAR', payload: { groupId: group.id, swimmerId: confirmClearSwimmer.swimmerId } })
              }
              if (confirmClearSwimmer.dbId) {
                onClearSwimmer(group.id, group.currentRunDrillId, confirmClearSwimmer.dbId)
              }
            }
            setConfirmClearSwimmer(null)
          }
        }}
        onCancel={() => setConfirmClearSwimmer(null)}
      />

    </div>
  )
}

function ActiveRunView({ run, onComplete }: { run: SessionRun; onComplete: () => void }) {
  const { state, dispatch } = useContext(LiveSessionContext)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [runDrills, setRunDrills] = useState<RunDrill[]>([])
  const [laneDrillResults, setLaneDrillResults] = useState<LaneDrillResult[]>([])
  const [templateName, setTemplateName] = useState('')
  const [confirmMove, setConfirmMove] = useState<{ swimmer: DbSwimmer; fromGroupId: string; toGroupId: string } | null>(null)
  const [showResetSessionConfirm, setShowResetSessionConfirm] = useState(false)
  const [showLaneEditor, setShowLaneEditor] = useState(false)
  const [editorScrollToLane, setEditorScrollToLane] = useState<number | null>(null)

  const initializedRef = useRef(false)

  useEffect(() => {
    getRunDrills(run.id).then(drills => {
      const sorted = drills.sort((a, b) => a.order - b.order)
      setRunDrills(sorted)
      if (sorted.length > 0 && !initializedRef.current) {
        initializedRef.current = true
        state.groups.forEach(group => {
          const first = sorted[0]
          dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: first.id, autoStart: first.tag !== 'warmup' && first.tag !== 'cooldown' } })
        })
      }
    })
    getLaneResults(run.id).then(results => {
      setLaneDrillResults(results)
    })
    getSession(run.session_id).then(s => setTemplateName(s?.name || 'Unknown'))
  }, [run.id, dispatch])

  useEffect(() => {
    const anyRunning = state.groups.some(group => group.running)
    if (anyRunning) {
      intervalRef.current = setInterval(() => {
        state.groups
          .filter(group => group.running)
          .forEach(group => {
            dispatch({ type: 'TICK_GROUP_TIMER', payload: { groupId: group.id, delta: 10 } })
          })
      }, 10)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state.groups, dispatch])

  const activeGroups = state.groups.filter(g => g.swimmers.length > 0)

  const handleComplete = async () => {
      for (const group of state.groups) {
        const drillId = group.currentRunDrillId
        if (!drillId) continue
        for (const swimmer of group.swimmers) {
          if (swimmer.dbId && swimmer.laps.length > 0) {
            const splits = laneRelativeToSplits(swimmer.laps, swimmer.offsetFromLaneStart ?? 0)
            for (const splitTime of splits) {
              await addLap({
                run_drill_id: drillId,
                swimmer_id: swimmer.dbId,
                time: splitTime / 1000,
              stroke_count: swimmer.strokeCount || 0,
              effort: '',
              notes: '',
            })
          }
        }
      }
    }
    await completeRun(run.id)
    dispatch({ type: 'CLEAR' })
    onComplete()
  }

  const openLaneEditor = async (scrollToLane?: number | null) => {
    setEditorScrollToLane(scrollToLane ?? null)
    setShowLaneEditor(true)
  }

  const openSwimmerPicker = async (groupId: string) => {
    const group = state.groups.find(g => g.id === groupId)
    openLaneEditor(group?.lane ?? null)
  }

  const getSwimmerGroup = (dbId: string): string | null => {
    for (const group of state.groups) {
      if (group.swimmers.some(s => s.dbId === dbId)) return group.id
    }
    return null
  }

  const addSwimmerToGroup = async (swimmer: DbSwimmer, groupId: string) => {
    const group = state.groups.find(g => g.id === groupId)
    dispatch({ type: 'ADD_SWIMMER', payload: { groupId, name: swimmer.name, dbId: swimmer.id } })
      await addSwimmerToRun(run.id, swimmer.id, group?.lane ?? 1)
  }

  const addSwimmerToLane = async (swimmer: DbSwimmer, targetGroupId: string) => {
    const fromGroupId = getSwimmerGroup(swimmer.id)
    if (fromGroupId !== null && fromGroupId !== targetGroupId) {
      setConfirmMove({ swimmer, fromGroupId, toGroupId: targetGroupId })
    } else if (fromGroupId === null) {
      const group = state.groups.find(g => g.id === targetGroupId)
      dispatch({ type: 'ADD_SWIMMER', payload: { groupId: targetGroupId, name: swimmer.name, dbId: swimmer.id } })
    await addSwimmerToRun(run.id, swimmer.id, group?.lane ?? 1)
    }
  }

  const moveSwimmer = async () => {
    if (!confirmMove) return
    const { swimmer, fromGroupId, toGroupId } = confirmMove
    const existingSwimmer = state.groups
      .find(g => g.id === fromGroupId)
      ?.swimmers.find(s => s.dbId === swimmer.id)
    if (existingSwimmer) {
      dispatch({ type: 'REMOVE_SWIMMER', payload: { groupId: fromGroupId, swimmerId: existingSwimmer.id } })
      await removeSwimmerFromRun(run.id, swimmer.id)
    }
    addSwimmerToGroup(swimmer, toGroupId)
    setConfirmMove(null)
  }

  const handleCompleteDrill = async (groupId: string) => {
    const group = state.groups.find(g => g.id === groupId)
    if (!group || !group.currentRunDrillId) return
    const drillId = group.currentRunDrillId
    const currentDrill = runDrills.find(d => d.id === drillId)
    const timingData = {
      laneElapsed: group.elapsed,
      swimmers: group.swimmers.map(s => ({
        dbId: s.dbId,
        name: s.name,
        offsetFromLaneStart: s.offsetFromLaneStart,
        finalElapsed: s.finalElapsed,
        laps: s.laps,
        completed: s.completed,
        strokeCount: s.strokeCount,
      })),
    }
    await setLaneResult({
      run_id: run.id,
      group_id: group.id,
      lane: group.lane,
      run_drill_id: drillId,
      completed: true,
      data: JSON.stringify(timingData),
    })
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId } })
    const nextDrill = runDrills.find(d => d.order > (currentDrill?.order ?? -1))
    if (nextDrill) {
      dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId, runDrillId: nextDrill.id, autoStart: nextDrill.tag !== 'warmup' && nextDrill.tag !== 'cooldown' } })
    }
  }

  const handleResetDrill = async (groupId: string) => {
    const group = state.groups.find(g => g.id === groupId)
    if (group?.currentRunDrillId) {
      const result = laneDrillResults.find(r => r.group_id === groupId && r.run_drill_id === group.currentRunDrillId)
      if (result) {
        await deleteLaneResult(result.id!)
        const refreshed = await getLaneResults(run.id)
        setLaneDrillResults(refreshed)
      }
    }
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId } })
  }

  const handleResetGroup = async (groupId: string) => {
    await deleteLaneResultsForGroup(run.id, groupId)
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
    dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId } })
    const first = runDrills.length > 0 ? runDrills[0] : null
    if (first) {
      dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId, runDrillId: first.id, autoStart: first.tag !== 'warmup' && first.tag !== 'cooldown' } })
    }
  }

  const handleResetSession = async () => {
    await deleteLaneResultsForRun(run.id)
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
    for (const group of state.groups) {
      dispatch({ type: 'CLEAR_GROUP_SWIMMER_DATA', payload: { groupId: group.id } })
      const first = runDrills.length > 0 ? runDrills[0] : null
      if (first) {
        dispatch({ type: 'SET_GROUP_DRILL', payload: { groupId: group.id, runDrillId: first.id, autoStart: first.tag !== 'warmup' && first.tag !== 'cooldown' } })
      }
    }
    setShowResetSessionConfirm(false)
  }

  const handleClearSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string) => {
    await clearSwimmerFromLaneResult(run.id, groupId, runDrillId, swimmerDbId)
    const refreshed = await getLaneResults(run.id)
    setLaneDrillResults(refreshed)
  }

  const handleEditSavedSwimmer = async (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: number[]; offsetFromLaneStart?: number; finalElapsed?: number }) => {
    const result = await getLaneResult(run.id, groupId, runDrillId)
    if (!result) return
    const data: SavedDrillData = JSON.parse(result.data)
    const swimmer = data.swimmers.find((s: SavedSwimmerData) => s.dbId === swimmerDbId)
    if (swimmer) {
      if (updates.laps !== undefined) {
        swimmer.laps = updates.laps
        if (swimmer.completed && updates.laps.length > 0) {
          swimmer.finalElapsed = updates.laps[updates.laps.length - 1]
        }
      }
      if (updates.offsetFromLaneStart !== undefined) swimmer.offsetFromLaneStart = updates.offsetFromLaneStart
      if (updates.finalElapsed !== undefined) swimmer.finalElapsed = updates.finalElapsed
      await setLaneResult({
        run_id: run.id,
        group_id: groupId,
        lane: result.lane,
        run_drill_id: runDrillId,
        completed: result.completed,
        data: JSON.stringify(data),
      })
      const refreshed = await getLaneResults(run.id)
      setLaneDrillResults(refreshed)
    }
  }

  return (
    <div>
      {/* Session Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 bg-surface-container-lowest rounded-xl p-3 md:p-4 border border-outline-variant">
        <div className="min-w-0">
          <h2 className="font-headline-md text-on-surface truncate">{templateName}</h2>
          <p className="text-label-sm text-on-surface-variant truncate">{run.date} &middot; {run.poolName} &middot; {run.poolLength}m &middot; {runDrills.length} drills</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openLaneEditor()}
            className="h-10 md:h-12 px-4 md:px-6 rounded-xl bg-primary-container text-on-primary-container font-bold flex items-center gap-2 hover:brightness-95 transition-all cursor-pointer text-sm md:text-base"
          >
            <span className="material-symbols-outlined md:text-lg">group</span>
            <span className="hidden sm:inline">Lane Swimmers</span>
          </button>
          <button
            onClick={() => setShowResetSessionConfirm(true)}
            className="h-10 md:h-12 px-3 md:px-6 rounded-xl border-2 border-outline text-on-surface-variant font-bold flex items-center gap-2 hover:bg-surface-variant transition-all cursor-pointer text-sm md:text-base"
          >
            <span className="material-symbols-outlined md:text-lg">refresh</span>
            Reset
          </button>
          <button
            onClick={handleComplete}
            className="h-10 md:h-12 px-4 md:px-6 bg-error text-on-error rounded-xl font-bold flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer text-sm md:text-base"
          >
            <span className="material-symbols-outlined md:text-lg">stop</span>
            Complete
          </button>
        </div>
      </div>

      {/* Group Grid — only active groups */}
      {activeGroups.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">pool</span>
          <p className="text-on-surface-variant">No swimmers assigned to any lane.</p>
        </div>
      ) : (
        <section className="mb-8">
          <div className="r-grid" style={{ '--grid-min': 'min(100%, 360px)' } as React.CSSProperties}>
            {activeGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                runDrills={runDrills}
                laneDrillResults={laneDrillResults}
                poolLength={run.poolLength}
                laneCount={activeGroups.length}
                onAddSwimmer={openSwimmerPicker}
                onCompleteDrill={handleCompleteDrill}
                onResetDrill={handleResetDrill}
                onResetGroup={handleResetGroup}
                onClearSwimmer={handleClearSwimmer}
                onEditSavedSwimmer={handleEditSavedSwimmer}
              />
            ))}
          </div>
        </section>
      )}

      {/* Confirmation Dialog for Moving Swimmer */}
      <ConfirmDialog
        open={confirmMove !== null}
        title="Move swimmer?"
        message={`${confirmMove?.swimmer.name ?? ''} is already assigned. Move them to the new group?`}
        confirmLabel="Move"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={moveSwimmer}
        onCancel={() => setConfirmMove(null)}
      />

      {/* Session Reset Confirmation Dialog */}
      <ConfirmDialog
        open={showResetSessionConfirm}
        title="Reset Session?"
        message="Clear all timing data and return all groups to the first drill? Swimmers will remain assigned. This cannot be undone."
        confirmLabel="Reset Session"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={handleResetSession}
        onCancel={() => setShowResetSessionConfirm(false)}
      />

      {/* Unified Lane Editor Modal */}
      {showLaneEditor && <LaneEditorModal
        state={state}
        editorScrollToLane={editorScrollToLane}
        onScrollHandled={() => setEditorScrollToLane(null)}
        onAddSwimmerToLane={addSwimmerToLane}
        onAddGroup={(lane, name, id) => dispatch({ type: 'ADD_GROUP', payload: { lane, name, id } })}
        onRemoveGroup={async (groupId) => {
          await deleteLaneResultsForGroup(run.id, groupId)
          dispatch({ type: 'REMOVE_GROUP', payload: { groupId } })
        }}
        onMoveSwimmer={(swimmerId, fromGroupId, toGroupId) => {
          const sw = state.groups.find(g => g.id === fromGroupId)?.swimmers.find(s => s.id === swimmerId)
          if (!sw) return
          dispatch({ type: 'REMOVE_SWIMMER', payload: { groupId: fromGroupId, swimmerId } })
          dispatch({ type: 'ADD_SWIMMER', payload: { groupId: toGroupId, name: sw.name, dbId: sw.dbId } })
        }}
        onClose={() => setShowLaneEditor(false)}
      />}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────

export const LiveDeck: React.FC = () => {
  const { dispatch } = useContext(LiveSessionContext)
  const [activeRun, setActiveRun] = useState<SessionRun | null>(null)
  const [checking, setChecking] = useState(true)

  const checkForActiveRun = async () => {
    const run = (await getActiveRun()) ?? null
    setActiveRun(run)
    if (run) {
      const links = await getRunSwimmerLinks(run.id)
      const allSwimmers = await getRunSwimmers(run.id)
      const swimmerMap = new Map(allSwimmers.map(s => [s.id, s]))
      const maxLane = links.length > 0 ? Math.max(...links.map(l => l.lane)) : 8
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
              offsetFromLaneStart: null,
              finalElapsed: null,
              laps: [],
              completed: false,
              strokeCount: null,
            }
          }),
          elapsed: 0,
          running: false,
          currentRunDrillId: null,
          drillOverride: null,
        }
      })
      dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId: run.id } })
    }
    setChecking(false)
  }

  useEffect(() => {
    getActiveRun().then(run => {
      const r = run ?? null
      setActiveRun(r)
      if (r) {
        Promise.all([getRunSwimmerLinks(r.id), getRunSwimmers(r.id)]).then(([links, allSwimmers]) => {
          const swimmerMap = new Map(allSwimmers.map(s => [s.id, s]))
          const maxLane = links.length > 0 ? Math.max(...links.map(l => l.lane)) : 8
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
                  offsetFromLaneStart: null,
                  finalElapsed: null,
                  laps: [],
                  completed: false,
                  strokeCount: null,
                }
              }),
              elapsed: 0,
              running: false,
              currentRunDrillId: null,
              drillOverride: null,
            }
          })
          dispatch({ type: 'INIT_FROM_RUN', payload: { groups, runId: r.id } })
          setChecking(false)
        })
      } else {
        setChecking(false)
      }
    })
  }, [dispatch])

  const handleStart = () => {
    checkForActiveRun()
  }

  const handleComplete = () => {
    dispatch({ type: 'CLEAR' })
    setActiveRun(null)
  }

  if (checking) return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">Loading...</p></div>

  if (activeRun) {
    return <ActiveRunView run={activeRun} onComplete={handleComplete} />
  }

  return <SessionSetup onStart={handleStart} />
}
