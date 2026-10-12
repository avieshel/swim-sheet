import { Fragment, useState, type ReactNode } from 'react'
import type { TimedGroup } from '../../context/LiveSessionContext'
import type { RunDrill, LaneDrillResult } from '../../api/runs'
import {
  buildDrillGroup,
  computeDrillRowProgress,
  firstIncompleteDrillRow,
  groupDrillRows,
  isDrillRowComplete,
  stripRepPrefix,
  type DrillGroup,
  type DrillRowProgress,
} from '../../utils/sessionProgress'
import { Icon } from '../Icon'
import { EquipmentIcons, type EquipmentType } from '../EquipmentIcons'

// A drill unrolling into at least this many rows folds behind its chevron.
// Below it the iterations stay inline, because a coach scanning the overview
// should see them without a tap.
const FOLD_THRESHOLD = 4
// Deep enough for a typical round, shallow enough that this section's own
// scroll stays the primary one on a phone.
const FOLD_CAP = 'max-h-[6.5rem]'
// Everything rendered inside a drill becomes one inset box, so an expanded
// drill reads as opened rather than as more list. Inset deeper on the left
// than the right, which does two jobs: the extra left inset is what makes the
// box read as "looking into" the drill, and the right inset is what carries
// the per-iteration timer/check controls inward, clear of the parent drill's
// own controls.
//
// That inward offset is deliberate, not incidental. The parent row sits at
// p-3/p-4, so its buttons are 12/16px from the card edge; the iteration rows
// land at 40/44px (box inset + pr-6) — a consistent 28px of depth at both
// breakpoints. 28px is slightly more than one control column (w-6 + gap-1),
// so an iteration icon never lands ambiguously between two parent icons; it
// reads as one clean step in. Shrinking the offset back toward 0 makes the
// icons straddle the parent's columns and look misaligned.
const FOLD_BOX = 'ml-8 md:ml-11 mr-4 md:mr-5 mb-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/30 overflow-hidden'
const PIP_THRESHOLD = 6
const REP_LABEL = /^\[\d+\/\d+\]$/

interface DrillsSectionProps {
  runDrills: RunDrill[]
  laneDrillResults: LaneDrillResult[]
  groups: TimedGroup[]
  onEnterTiming: (drillId: string) => void
  onToggleDrillDone: (groupId: string, runDrillId: string, advanceTo: string | null) => void | Promise<void>
}

function toggleIn(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function groupTitle(group: DrillGroup): string {
  return group.rows.length === 1
    ? group.rows[0].name
    : `${group.setCount} × ${stripRepPrefix(group.rows[0].name)}`
}

function groupSubtitle(group: DrillGroup): string {
  const meters = group.rows.reduce((sum, row) => sum + row.distance, 0)
  if (group.stepCount <= 1) return `${meters}m ${group.rows[0].stroke}`
  return `${meters}m · ${group.setCount} rounds × ${group.stepCount} steps`
}

// Tap target for reaching the granular view: jumps straight into timing the
// next unfinished iteration, skipping the expand-and-hunt sequence.
function GroupProgress({ progress, onJump }: {
  progress: DrillRowProgress
  onJump: () => void
}) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <button
      onClick={onJump}
      title="Jump to the next unfinished iteration"
      className="flex items-center gap-1.5 shrink-0 cursor-pointer"
    >
      {progress.total <= PIP_THRESHOLD ? (
        <span className="flex items-center gap-1" aria-label={`${progress.done} of ${progress.total} iterations done`}>
          {Array.from({ length: progress.total }, (_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i < progress.done ? 'bg-primary' : 'bg-outline-variant'}`}
            />
          ))}
        </span>
      ) : (
        <span className="block w-14 h-1 rounded-full bg-outline-variant overflow-hidden">
          <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
        </span>
      )}
      <span className="text-label-sm text-on-surface-variant tabular-nums">{progress.done}/{progress.total}</span>
    </button>
  )
}

function IterationLine({ row, label, done, nested, onEnterTiming, onToggleDone }: {
  row: RunDrill
  label: string
  done: boolean
  nested: boolean
  onEnterTiming: (drillId: string) => void
  onToggleDone: (row: RunDrill) => void
}) {
  const repLabel = row.instructions && REP_LABEL.test(row.instructions) ? row.instructions : null
  const note = repLabel ? null : row.instructions
  return (
    <div className={`flex items-center justify-between gap-2 py-1 pr-6 ${nested ? 'pl-6' : 'pl-3'}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`text-label-sm font-semibold tabular-nums w-5 shrink-0 ${done ? 'text-primary' : 'text-on-surface-variant'}`}>
          {label}
        </span>
        <span className="text-label-sm text-on-surface truncate">{row.distance}m {row.stroke}</span>
        {row.interval && <span className="text-label-sm text-primary shrink-0">@ {row.interval}</span>}
        {repLabel && <span className="text-label-sm text-on-surface-variant shrink-0">{repLabel}</span>}
        {note && <span className="text-label-sm text-on-surface-variant truncate">{note}</span>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEnterTiming(row.id)}
          title={`Time drill: ${stripRepPrefix(row.name)}`}
          className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <Icon name="timer" size="xs" />
        </button>
        <button
          onClick={() => onToggleDone(row)}
          title={done ? 'Mark incomplete' : 'Mark complete'}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            done ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant hover:border-primary text-transparent'
          }`}
        >
          {done && <Icon name="check" size="xs" />}
        </button>
      </div>
    </div>
  )
}

function DrillSetRows({ group, laneDrillResults, activeGroups, onEnterTiming, onToggleDone }: {
  group: DrillGroup
  laneDrillResults: LaneDrillResult[]
  activeGroups: TimedGroup[]
  onEnterTiming: (drillId: string) => void
  onToggleDone: (row: RunDrill) => void
}) {
  return (
    <>
      {group.sets.map((set, setIdx) => {
        const nested = set.rows.length > 1
        return (
          <Fragment key={setIdx}>
            {nested && (
              <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-0.5">
                <span className="text-label-sm font-semibold text-on-surface">Round {set.label ?? setIdx + 1}</span>
                <span className="text-label-sm text-on-surface-variant tabular-nums">
                  {set.rows.filter(r => isDrillRowComplete(r, laneDrillResults, activeGroups)).length}/{set.rows.length}
                </span>
              </div>
            )}
            {set.rows.map((row, rowIdx) => (
              <IterationLine
                key={row.id}
                row={row}
                label={String(rowIdx + 1)}
                done={isDrillRowComplete(row, laneDrillResults, activeGroups)}
                nested={nested}
                onEnterTiming={onEnterTiming}
                onToggleDone={onToggleDone}
              />
            ))}
          </Fragment>
        )
      })}
    </>
  )
}

function DrillFold({ children }: { children: ReactNode }) {
  return <div className={FOLD_BOX}>{children}</div>
}

function GroupDetails({ group, divider }: { group: DrillGroup; divider: boolean }) {
  const row = group.rows[0]
  const hasEquipment = Boolean(row.equipment && row.equipment.length > 0)
  const hasDescription = Boolean(row.notes && row.notes.trim())
  return (
    <div className={`px-3 pb-3 pt-2 text-label-sm text-on-surface-variant space-y-2 ${divider ? 'border-t border-outline-variant/20' : ''}`}>
      {hasDescription && (
        <div>
          <span className="font-semibold text-on-surface block mb-0.5">Description</span>
          <p className="text-on-surface/90">{row.notes}</p>
        </div>
      )}
      {hasEquipment && (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-on-surface">Equipment:</span>
          <span className="inline-flex items-center gap-1 text-primary font-medium capitalize">
            <EquipmentIcons type={row.equipment![0] as EquipmentType} className="w-4 h-4" />
            {row.equipment!.join(', ')}
          </span>
        </div>
      )}
      {!hasDescription && !hasEquipment && (
        <p className="italic text-on-surface-variant/60">No additional details for this drill.</p>
      )}
    </div>
  )
}

export function DrillsSection({
  runDrills, laneDrillResults, groups,
  onEnterTiming, onToggleDrillDone
}: DrillsSectionProps) {
  const [openFolds, setOpenFolds] = useState<Set<string>>(() => new Set())
  const [uncappedFolds, setUncappedFolds] = useState<Set<string>>(() => new Set())
  const [openDetails, setOpenDetails] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState(false)
  const activeGroups = groups.filter(g => g.swimmers.length > 0)
  const drillGroups = groupDrillRows(runDrills).map(buildDrillGroup)
  const hasDrills = drillGroups.length > 0
  const totalMeters = runDrills.reduce((s, d) => s + d.distance, 0)

  // Sequential, not forEach: each call refreshes laneDrillResults, so a
  // parallel burst would interleave stale reads.
  const toggleRowDone = async (row: RunDrill) => {
    const done = isDrillRowComplete(row, laneDrillResults, activeGroups)
    for (const g of activeGroups) {
      if (done === isDrillRowComplete(row, laneDrillResults, [g])) {
        await onToggleDrillDone(g.id, row.id, null)
      }
    }
  }

  const toggleGroupDone = async (group: DrillGroup) => {
    const complete = computeDrillRowProgress(group.rows, laneDrillResults, activeGroups).complete
    const pending: Array<{ groupId: string; runDrillId: string }> = []
    for (const g of activeGroups) {
      for (const row of group.rows) {
        if (!complete !== isDrillRowComplete(row, laneDrillResults, [g])) {
          pending.push({ groupId: g.id, runDrillId: row.id })
        }
      }
    }
    for (const p of pending) await onToggleDrillDone(p.groupId, p.runDrillId, null)
  }

  return (
    <div
      className={
        collapsed
          ? 'shrink-0 rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden mt-4'
          : 'flex-1 min-h-0 flex flex-col rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden mt-4'
      }
    >
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full shrink-0 flex items-center justify-between gap-3 p-3.5 md:p-4 cursor-pointer hover:bg-surface-container-low transition-all"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-headline-sm text-on-surface">Drills</span>
          <span className="text-label-sm text-on-surface-variant font-medium tabular-nums">
            {hasDrills ? `${drillGroups.length} drills · ${totalMeters}m` : 'No drills'}
          </span>
        </span>
        <Icon name={collapsed ? 'chevron_right' : 'expand_more'} color="on-surface-variant" />
      </button>

      {!collapsed && hasDrills && (
        <div className="flex-1 min-h-0 divide-y divide-outline-variant/10 border-t border-outline-variant/20 overflow-y-auto">
          {drillGroups.map((group, idx) => {
            const key = group.rows[0].id
            const folded = group.rows.length >= FOLD_THRESHOLD
            const open = folded ? openFolds.has(key) : true
            // What the chevron actually toggles. Differs from `open`: a short
            // group shows its iterations unconditionally, so its chevron drives
            // the details panel instead and must not read as always-expanded.
            const expanded = folded ? open : openDetails.has(key)
            const progress = computeDrillRowProgress(group.rows, laneDrillResults, activeGroups)
            const jumpRow = firstIncompleteDrillRow(group.rows, laneDrillResults, activeGroups)
            const equipment = group.rows[0].equipment
            const hasEquipment = Boolean(equipment && equipment.length > 0)
            const showIterations = group.rows.length > 1 && (!folded || open)
            const showDetails = folded ? open : openDetails.has(key)
            const capped = folded && open && !uncappedFolds.has(key)

            return (
              <div key={key} className="transition-colors hover:bg-surface-container-low/50">
                <div className="flex items-center justify-between gap-3 p-3 md:p-4">
                  <button
                    onClick={() => folded
                      ? setOpenFolds(prev => toggleIn(prev, key))
                      : setOpenDetails(prev => toggleIn(prev, key))}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                  >
                    <span className="text-label-sm text-on-surface-variant tabular-nums w-5 shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-on-surface truncate">{groupTitle(group)}</span>
                        {hasEquipment && (
                          <span className="inline-flex items-center text-primary" title={equipment!.join(', ')}>
                            <EquipmentIcons type={equipment![0] as EquipmentType} className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <div className="text-label-sm text-on-surface-variant">{groupSubtitle(group)}</div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {group.rows.length > 1 && (
                      <GroupProgress
                        progress={progress}
                        onJump={() => jumpRow && onEnterTiming(jumpRow.id)}
                      />
                    )}
                    <button
                      onClick={() => jumpRow && onEnterTiming(jumpRow.id)}
                      title={`Time drill: ${stripRepPrefix(group.rows[0].name)}`}
                      className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                    >
                      <Icon name="timer" size="sm" />
                    </button>
                    <button
                      onClick={() => toggleGroupDone(group)}
                      title={progress.complete ? 'Mark incomplete' : 'Mark complete'}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        progress.complete
                          ? 'bg-primary border-primary text-on-primary'
                          : 'border-outline-variant hover:border-primary text-transparent'
                      }`}
                    >
                      {progress.complete && <Icon name="check" size="xs" />}
                    </button>
                    <button
                      onClick={() => folded
                        ? setOpenFolds(prev => toggleIn(prev, key))
                        : setOpenDetails(prev => toggleIn(prev, key))}
                      className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      title={expanded
                        ? (folded ? 'Hide iterations' : 'Hide details')
                        : (folded ? 'Show iterations' : 'Show details')}
                    >
                      <Icon name={expanded ? 'expand_more' : 'chevron_right'} size="sm" />
                    </button>
                  </div>
                </div>

                {(showIterations || showDetails) && (
                <DrillFold>
                  {showIterations && (
                    <div className={`pt-0.5 ${capped ? `${FOLD_CAP} overflow-y-auto` : 'pb-1'}`}>
                      <DrillSetRows
                        group={group}
                        laneDrillResults={laneDrillResults}
                        activeGroups={activeGroups}
                        onEnterTiming={onEnterTiming}
                        onToggleDone={toggleRowDone}
                      />
                    </div>
                  )}

                  {capped && progress.total > 0 && (
                    <button
                      onClick={() => setUncappedFolds(prev => toggleIn(prev, key))}
                      className="w-full flex items-center justify-center gap-1 py-1.5 border-t border-outline-variant/20 text-label-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                    >
                      {progress.done}/{progress.total} done
                      <Icon name="unfold_more" size="xs" />
                    </button>
                  )}

                  {showDetails && <GroupDetails group={group} divider={showIterations || capped} />}
                </DrillFold>
              )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}