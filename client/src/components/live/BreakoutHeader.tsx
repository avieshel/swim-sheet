import { useState, useRef, useEffect } from 'react'
import type { TimedGroup } from '../../context/LiveSessionContext'
import type { RunDrill, LaneDrillResult } from '../../api/runs'
import { Icon } from '../Icon'
import { SwimmerFormModal } from '../SwimmerFormModal'

export interface TimingBreakout {
  drillId: string
  // null = all lanes/swimmers (legacy drill-scoped timing); string[] = focused swimmers
  swimmerIds: string[] | null
}

// The drill-name line is a vertical roller. Each drill is a snap page; the
// centered one is the current drill. On mobile you flick up/down with a finger
// to "roll" through the session's drills; the up/down chevrons (styled like the
// swimmer ordering) step one drill at a time. This replaces the old dropdown picker.
function DrillNameScroller({ runDrills, drillId, onSwitchDrill }: {
  runDrills: RunDrill[]
  drillId: string
  onSwitchDrill: (drillId: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drillIndex = runDrills.findIndex(d => d.id === drillId)
  const prev = drillIndex > 0 ? runDrills[drillIndex - 1] : null
  const next = drillIndex >= 0 && drillIndex < runDrills.length - 1 ? runDrills[drillIndex + 1] : null

  const pageHeight = (el: HTMLElement): number =>
    el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetHeight : el.clientHeight

  useEffect(() => {
    const el = ref.current
    if (!el || el.clientHeight === 0) return
    const p = pageHeight(el)
    el.scrollTo({ top: drillIndex * p - (el.clientHeight - p) / 2, behavior: 'auto' })
  }, [drillIndex, runDrills.length])

  const handleScroll = () => {
    const el = ref.current
    if (!el || el.clientHeight === 0 || runDrills.length === 0) return
    const idx = Math.max(0, Math.min(runDrills.length - 1, Math.round(el.scrollTop / pageHeight(el))))
    const nxt = runDrills[idx]
    if (nxt && nxt.id !== drillId) onSwitchDrill(nxt.id)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-px shrink-0">
        <button
          onClick={() => prev && onSwitchDrill(prev.id)}
          disabled={!prev}
          title="Previous drill"
          className="h-9 w-9 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
        >
          <Icon name="keyboard_arrow_up" size="md" />
        </button>
        <button
          onClick={() => next && onSwitchDrill(next.id)}
          disabled={!next}
          title="Next drill"
          className="h-9 w-9 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
        >
          <Icon name="keyboard_arrow_down" size="md" />
        </button>
      </div>
      <div
        ref={ref}
        onScroll={handleScroll}
        className="overflow-y-auto snap-y snap-mandatory flex-1 min-w-0 select-none rounded-xl bg-surface-container-highest/40 h-20 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {runDrills.map((d, i) => (
          <div
            key={d.id}
            className="snap-center shrink-0 h-20 flex flex-col items-center justify-center text-center px-4"
          >
            <div className="flex items-center gap-2 max-w-full">
              <span className="text-label-sm text-on-surface-variant tabular-nums shrink-0">{i + 1}.)</span>
              <span className="font-display-timer text-2xl text-on-surface truncate">{d.name}</span>
            </div>
            <span className="text-label-sm text-on-surface-variant">{d.distance}m {d.stroke}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BreakoutAddSwimmer({ groups, focusIds, onAddSwimmer, onAddTempSwimmer, onCreateSwimmer }: {
  groups: TimedGroup[]
  focusIds: Set<string>
  onAddSwimmer: (dbId: string) => void
  onAddTempSwimmer: () => void
  onCreateSwimmer: (data: { name: string; group: string; notes: string; status: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const candidates = groups.flatMap(g =>
    g.swimmers
      .filter(s => s.dbId && !focusIds.has(s.dbId))
      .map(s => ({ dbId: s.dbId as string, name: s.name, lane: g.lane }))
  )

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 px-3 rounded-full bg-primary-container text-on-primary-container flex items-center gap-1 hover:brightness-95 transition-all cursor-pointer text-label-sm font-bold shrink-0"
        title="Add swimmer to focus"
      >
        <Icon name="person_add" size="sm" />
        <span className="hidden md:inline">Add</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-72 max-h-80 overflow-y-auto rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-lg p-2">
            <div className="text-label-caps text-on-surface-variant px-2 py-1.5">Add swimmer to timing</div>
            {candidates.length === 0 ? (
              <div className="px-3 py-3 text-label-sm text-on-surface-variant text-center">All swimmers are in focus.</div>
            ) : (
              candidates.map(c => (
                <button
                  key={`${c.lane}:${c.dbId}`}
                  onClick={() => { onAddSwimmer(c.dbId); setOpen(false) }}
                  className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-surface-variant transition-colors cursor-pointer"
                >
                  <span className="text-label-sm font-bold text-on-surface-variant">L{c.lane}</span>
                  <span className="text-on-surface truncate">{c.name}</span>
                </button>
              ))
            )}
            <div className="border-t border-outline-variant my-1" />
            <button
              onClick={() => { onAddTempSwimmer(); setOpen(false) }}
              className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-surface-variant transition-colors cursor-pointer"
            >
              <Icon name="casino" size="sm" className="text-primary" />
              <span className="text-on-surface text-label-sm">Add temp swimmer</span>
            </button>
            <button
              onClick={() => { setShowCreate(true); setOpen(false) }}
              className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-surface-variant transition-colors cursor-pointer"
            >
              <Icon name="person_add" size="sm" className="text-primary" />
              <span className="text-on-surface text-label-sm">Create new swimmer</span>
            </button>
          </div>
        </>
      )}
      {showCreate && (
        <SwimmerFormModal
          open={showCreate}
          editingId={null}
          onSave={(data) => { onCreateSwimmer({ name: data.name, group: data.group, notes: data.notes, status: data.status }); setShowCreate(false) }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  )
}

export function BreakoutHeader({ runDrills, timingBreakout, laneDrillResults, groups, onExit, onSwitchDrill, onToggleBreakoutDone, onAddSwimmer, onAddTempSwimmer, onCreateSwimmer, onMarkAllDone }: {
  runDrills: RunDrill[]
  timingBreakout: TimingBreakout
  laneDrillResults: LaneDrillResult[]
  groups: TimedGroup[]
  onExit: () => void
  onSwitchDrill: (drillId: string) => void
  onToggleBreakoutDone: () => void
  onAddSwimmer: (dbId: string) => void
  onAddTempSwimmer: () => void
  onCreateSwimmer: (data: { name: string; group: string; notes: string; status: string }) => void
  onMarkAllDone: () => void
}) {
  const isFocus = timingBreakout.swimmerIds !== null
  const focusIds = new Set(timingBreakout.swimmerIds ?? [])
  const relevantGroups = isFocus
    ? groups.filter(g => g.swimmers.some(s => s.dbId && focusIds.has(s.dbId)))
    : groups.filter(g => g.swimmers.length > 0)
  const isDrillDone = relevantGroups.length > 0 && relevantGroups.every(g =>
    laneDrillResults.some(r => r.groupId === g.id && r.runDrillId === timingBreakout.drillId && r.completed)
  )
  const drill = runDrills.find(d => d.id === timingBreakout.drillId)

  return (
    <div className="mb-4 rounded-2xl bg-surface-container-lowest border border-outline-variant p-3 md:p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-label-sm text-on-surface-variant tabular-nums w-5 shrink-0">
            {runDrills.findIndex(d => d.id === timingBreakout.drillId) + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-on-surface truncate flex items-center gap-2">
              {isFocus ? 'Timing focus' : 'Timing all lanes'}
              {drill && <span className="text-on-surface-variant font-normal">· {drill.name}</span>}
            </div>
            {isFocus && (
              <div className="text-label-sm text-on-surface-variant">
                {timingBreakout.swimmerIds!.length} swimmer{timingBreakout.swimmerIds!.length === 1 ? '' : 's'} selected
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isFocus && (
            <>
              <button
                onClick={onMarkAllDone}
                title={isDrillDone ? 'Mark incomplete' : 'Mark all done'}
                className={`h-9 px-3 rounded-full flex items-center gap-1 transition-all cursor-pointer text-label-sm font-bold ${
                  isDrillDone
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-variant text-on-surface-variant hover:bg-primary-container/40'
                }`}
              >
                <Icon name="check" size="sm" />
                <span className="hidden md:inline">{isDrillDone ? 'Done' : 'Mark all'}</span>
              </button>
              <div className="relative">
                <BreakoutAddSwimmer
                  groups={groups}
                  focusIds={focusIds}
                  onAddSwimmer={onAddSwimmer}
                  onAddTempSwimmer={onAddTempSwimmer}
                  onCreateSwimmer={onCreateSwimmer}
                />
              </div>
            </>
          )}

          <button
            onClick={onToggleBreakoutDone}
            title={isDrillDone ? 'Mark incomplete' : 'Mark drill complete'}
            className={`h-9 w-9 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isDrillDone
                ? 'bg-primary border-primary text-on-primary'
                : 'border-outline-variant hover:border-primary text-transparent'
            }`}
          >
            {isDrillDone && <Icon name="check" size="xs" />}
          </button>

          <button
            onClick={onExit}
            title="Exit timing / Overview"
            className="h-9 w-9 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer relative"
          >
            <Icon name="timer" size="sm" />
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-3 h-3 rounded-full bg-surface text-error text-[10px] font-bold">
              &times;
            </span>
          </button>
        </div>
      </div>

      <div className="mt-3">
        <DrillNameScroller runDrills={runDrills} drillId={timingBreakout.drillId} onSwitchDrill={onSwitchDrill} />
      </div>
    </div>
  )
}
