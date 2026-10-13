import { useState, useContext } from 'react'
import { LiveSessionContext, type TimedGroup } from '../context/LiveSessionContext'
import type { LaneDrillResult, SwimmerDrillStatus } from '../api/runs'
import type { LapEntry, SavedDrillData, SavedSwimmerData } from '../api/types'
import { ActiveSwimmerRow, SavedSwimmerRow } from './SwimmerRows'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'

interface SwimmerBreakoutCardProps {
  swimmer: TimedGroup['swimmers'][number]
  group: TimedGroup
  groups: TimedGroup[]
  drillId: string
  runId: string | null
  laneDrillResults: LaneDrillResult[]
  rosterSwimmers?: Array<{ id: string; name: string; group: string; notes: string; status: string }>
  onSwimmerSaved?: () => void
  onClearSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string) => void
  onEditSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string, updates: { laps?: LapEntry[]; startedAt?: number | null; completedAt?: number | null; name?: string; dbId?: string }) => void
  onSwimmerStart: (groupId: string, swimmerId: number) => void
  onSwimmerLap: (groupId: string, swimmerId: number) => void
  onSwimmerComplete: (groupId: string, swimmerId: number) => void
  onSwimmerSkip: (groupId: string, swimmerId: number) => void
  onSwimmerMarkDone: (groupId: string, swimmerId: number) => void
  onSkipSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string) => void
  onMarkDoneSavedSwimmer: (groupId: string, runDrillId: string, swimmerDbId: string) => void
  onMoveSwimmer: (swimmerId: number, direction: 'up' | 'down') => void
  onRemoveFromFocus: (dbId: string) => void
}

export function SwimmerBreakoutCard({
  swimmer, group, groups, drillId, runId, laneDrillResults,
  rosterSwimmers, onSwimmerSaved, onClearSwimmer, onEditSavedSwimmer,
  onSwimmerStart, onSwimmerLap, onSwimmerComplete, onSwimmerSkip, onSwimmerMarkDone,
  onSkipSavedSwimmer, onMarkDoneSavedSwimmer, onMoveSwimmer, onRemoveFromFocus,
}: SwimmerBreakoutCardProps) {
  const { dispatch } = useContext(LiveSessionContext)
  const [confirmClearSwimmer, setConfirmClearSwimmer] = useState<{ swimmerId: number; dbId?: string } | null>(null)
  const [lapEditMode, setLapEditMode] = useState<Record<string, boolean>>({})
  const toggleLapEdit = (key: string) => setLapEditMode(prev => ({ ...prev, [key]: !prev[key] }))

  const laneResult = laneDrillResults.find(r => r.groupId === group.id && r.runDrillId === drillId)
  const isCompleted = laneResult?.completed === true
  const savedData: SavedDrillData | null = isCompleted && laneResult?.data ? JSON.parse(laneResult.data) : null
  const saved = savedData?.swimmers?.find(s => s.dbId === swimmer.dbId) ?? null
  const rawSwimmer = laneResult?.data
    ? (JSON.parse(laneResult.data).swimmers as SavedSwimmerData[]).find(s => s.dbId === swimmer.dbId)
    : undefined
  const savedStatus: SwimmerDrillStatus | undefined = rawSwimmer?.status

  const findExistingAllocation = (dbId: string): { groupId: string; groupName: string } | null => {
    const match = groups.find(g => g.id !== group.id && g.swimmers.some(s => s.dbId === dbId))
    if (!match) return null
    const found = match.swimmers.find(s => s.dbId === dbId)
    if (!found) return null
    return { groupId: match.id, groupName: match.name }
  }

  return (
    <div className="rounded-2xl p-3 sm:p-4 bg-surface-container-lowest border border-outline-variant shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded text-label-sm font-bold bg-secondary-container text-on-secondary-container shrink-0">
            L{group.lane}
          </span>
          <span className="text-label-sm text-on-surface-variant truncate">{group.name}</span>
        </div>
        <button
          onClick={() => swimmer.dbId && onRemoveFromFocus(swimmer.dbId)}
          className="h-8 w-8 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-error-container hover:text-on-error-container transition-all cursor-pointer shrink-0"
          title="Remove from timing focus"
        >
          <Icon name="close" size="sm" />
        </button>
      </div>

      {saved ? (
        <SavedSwimmerRow
          saved={saved}
          savedData={savedData!}
          group={group}
          runId={runId}
          runDrillId={drillId}
          sessionElapsed={0}
          lapEditMode={lapEditMode}
          toggleLapEdit={toggleLapEdit}
          onEditSavedSwimmer={onEditSavedSwimmer}
          onClearSavedSwimmer={(dbId) => onEditSavedSwimmer(group.id, drillId, dbId, { laps: [], startedAt: null, completedAt: null })}
          onSkipSavedSwimmer={(dbId) => onSkipSavedSwimmer(group.id, drillId, dbId)}
          onMarkDoneSavedSwimmer={(dbId) => onMarkDoneSavedSwimmer(group.id, drillId, dbId)}
          rosterSwimmers={rosterSwimmers}
          onSwimmerSaved={onSwimmerSaved}
          currentGroupId={group.id}
          findExistingAllocation={findExistingAllocation}
          onRemoveFromFocus={onRemoveFromFocus}
        />
      ) : (
        <ActiveSwimmerRow
          swimmer={swimmer}
          group={group}
          idx={group.swimmers.findIndex(s => s.id === swimmer.id)}
          runId={runId}
          drillId={drillId}
          onStart={(id) => onSwimmerStart(group.id, id)}
          onLap={(id) => onSwimmerLap(group.id, id)}
          onComplete={(id) => onSwimmerComplete(group.id, id)}
          onClear={(swimmerId, dbId) => setConfirmClearSwimmer({ swimmerId, dbId })}
          onSkip={(id) => onSwimmerSkip(group.id, id)}
          onMarkDone={(id) => onSwimmerMarkDone(group.id, id)}
          handleMoveSwimmer={onMoveSwimmer}
          rosterSwimmers={rosterSwimmers}
          onSwimmerSaved={onSwimmerSaved}
          currentGroupId={group.id}
          findExistingAllocation={findExistingAllocation}
          onRemoveFromFocus={() => swimmer.dbId && onRemoveFromFocus(swimmer.dbId)}
          savedStatus={savedStatus}
        />
      )}

      <ConfirmDialog
        open={confirmClearSwimmer !== null}
        title="Clear swimmer?"
        message="Clear this swimmer's offsets, laps, and timing data for the current drill?"
        confirmLabel="Clear"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={() => {
          if (confirmClearSwimmer) {
            if (confirmClearSwimmer.swimmerId > 0) {
              dispatch({ type: 'SWIMMER_CLEAR', payload: { groupId: group.id, swimmerId: confirmClearSwimmer.swimmerId } })
            }
            if (confirmClearSwimmer.dbId && runId) {
              onClearSwimmer(group.id, drillId, confirmClearSwimmer.dbId)
            }
          }
          setConfirmClearSwimmer(null)
        }}
        onCancel={() => setConfirmClearSwimmer(null)}
      />
    </div>
  )
}
