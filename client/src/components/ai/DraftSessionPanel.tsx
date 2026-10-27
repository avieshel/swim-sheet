import { useState } from 'react'
import { Icon } from '../Icon'
import { DraftDrillModal } from './DraftDrillModal'
import { DrillsList, type DrillsListRow } from '../session/DrillsList'
import { draftDrillDistance, draftTotalDistance } from '../../services/sessionDraft/apply'
import { validateSessionDraft } from '../../services/sessionDraft/validate'
import { drillSubtitle, drillStepLines, drillEquipment } from '../../utils/drillHelpers'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config'
import type { EquipmentType } from '../EquipmentIcons'
import type { SessionDraftDrillV1, SessionDraftV1 } from '../../../../shared/sessionDraft/types'

interface DraftSessionPanelProps {
  draft: SessionDraftV1
  onChange: (draft: SessionDraftV1) => void
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
}

function draftRow(
  drill: SessionDraftDrillV1,
  index: number,
  count: number,
  onEdit: () => void,
  onRemove: () => void,
  onMove: (direction: -1 | 1) => void,
): DrillsListRow {
  return {
    id: `draft-${index}`,
    name: drill.name,
    repeatCount: drill.repeatCount,
    distance: draftDrillDistance(drill.items, drill.repeatCount),
    subtitle: drillSubtitle(drill),
    description: drill.description,
    badges: [],
    equipment: drillEquipment(drill) as EquipmentType[],
    steps: drillStepLines(drill),
    onEdit,
    onDelete: onRemove,
    canDelete: count > 1,
    onMove,
    canMoveUp: index > 0,
    canMoveDown: index < count - 1,
  }
}

export function DraftSessionPanel({ draft, onChange, onSave, onDiscard, saving = false }: DraftSessionPanelProps) {
  const { maxDrills } = defaultSessionDraftConfig.limits
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const validation = validateSessionDraft(draft)
  const problem = validation.ok ? null : validation.error.message

  const replaceDrill = (index: number, drill: SessionDraftDrillV1) => {
    const drills = [...draft.drills]
    drills[index] = drill
    onChange({ ...draft, drills })
  }

  const removeDrill = (index: number) => {
    onChange({ ...draft, drills: draft.drills.filter((_, i) => i !== index) })
    if (editingIndex === index) setEditingIndex(null)
  }

  const moveDrill = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= draft.drills.length) return
    const drills = [...draft.drills]
    const [moved] = drills.splice(index, 1)
    drills.splice(target, 0, moved)
    if (editingIndex !== null) {
      if (editingIndex === index) setEditingIndex(target)
      else if (editingIndex === target) setEditingIndex(index)
    }
    onChange({ ...draft, drills })
  }

  const addDrill = () => {
    onChange({
      ...draft,
      drills: [
        ...draft.drills,
        { name: 'New drill', repeatCount: 1, items: [{ distance: 100, stroke: 'freestyle', repeatCount: 1 }] },
      ],
    })
  }

  const rows = draft.drills.map((drill, index) =>
    draftRow(
      drill,
      index,
      draft.drills.length,
      () => setEditingIndex(index),
      () => removeDrill(index),
      (direction) => moveDrill(index, direction),
    ),
  )

  const editingDrill = editingIndex !== null ? draft.drills[editingIndex] : undefined

  return (
    <>
      <DrillsList
        title="Proposed session"
        rows={rows}
        headerExtra={
          <div className="px-3.5 md:p-4 pb-3">
            <label htmlFor="draft-session-name" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">
              Session name
            </label>
            <input
              id="draft-session-name"
              type="text"
              value={draft.session.name}
              onChange={(e) => onChange({ ...draft, session: { name: e.target.value } })}
              className="w-full min-h-12 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        }
        actions={
          <div className="rounded-xl bg-primary/5 px-3 py-2 text-right">
            <span className="block font-label-caps text-on-surface-variant mb-0.5">Total distance</span>
            <span className="font-headline-md text-primary font-bold tabular-nums">{draftTotalDistance(draft)}m</span>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              aria-label="Add drill"
              onClick={addDrill}
              disabled={draft.drills.length >= maxDrills}
              className="h-11 min-w-[44px] text-label-sm text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none disabled:opacity-40"
            >
              <Icon name="add_circle" size="sm" />
              Add drill
            </button>

            {problem && (
              <div className="mt-1 flex items-center gap-2 text-label-sm text-error bg-error-container/20 px-3 py-2 rounded-xl" role="alert">
                <Icon name="error" size="sm" />
                {problem}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 mt-3">
              <button
                type="button"
                onClick={onSave}
                disabled={saving || validation.ok === false}
                className="h-12 min-w-[44px] flex items-center justify-center gap-2 px-5 bg-primary text-on-primary rounded-xl font-label-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
              >
                {saving ? <Icon name="hourglass_empty" /> : <Icon name="check" />}
                Save session
              </button>
              <button
                type="button"
                aria-label="Discard proposal"
                onClick={onDiscard}
                disabled={saving}
                className="h-12 min-w-[44px] px-5 border border-outline text-on-surface rounded-xl font-label-sm font-bold hover:bg-surface-container-low transition-colors disabled:opacity-50"
              >
                Discard
              </button>
            </div>
          </>
        }
      />

      {editingDrill !== undefined && editingIndex !== null && (
        <DraftDrillModal
          key={editingIndex}
          index={editingIndex}
          drill={editingDrill}
          onChange={(next) => replaceDrill(editingIndex, next)}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </>
  )
}
