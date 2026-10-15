import { Icon } from '../Icon'
import { DraftDrillCard } from './DraftDrillCard'
import { draftTotalDistance } from '../../services/sessionDraft/apply'
import { validateSessionDraft } from '../../services/sessionDraft/validate'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config'
import type { SessionDraftDrillV1, SessionDraftV1 } from '../../../../shared/sessionDraft/types'

interface DraftSessionPanelProps {
  draft: SessionDraftV1
  onChange: (draft: SessionDraftV1) => void
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
}

export function DraftSessionPanel({ draft, onChange, onSave, onDiscard, saving = false }: DraftSessionPanelProps) {
  const { maxDrills } = defaultSessionDraftConfig.limits
  const validation = validateSessionDraft(draft)
  const problem = validation.ok ? null : validation.error.message

  const replaceDrill = (index: number, drill: SessionDraftDrillV1) => {
    const drills = [...draft.drills]
    drills[index] = drill
    onChange({ ...draft, drills })
  }

  const removeDrill = (index: number) => {
    onChange({ ...draft, drills: draft.drills.filter((_, i) => i !== index) })
  }

  const moveDrill = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= draft.drills.length) return
    const drills = [...draft.drills]
    const [moved] = drills.splice(index, 1)
    drills.splice(target, 0, moved)
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

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 md:p-6 border border-outline-variant flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-headline-md text-on-surface mb-2">Proposed session</h3>
          <label htmlFor="draft-session-name" className="block font-label-caps text-on-surface-variant mb-1">
            Session name
          </label>
          <input
            id="draft-session-name"
            type="text"
            value={draft.session.name}
            onChange={(e) => onChange({ ...draft, session: { name: e.target.value } })}
            className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary px-2 py-1.5 text-sm outline-none rounded-t-lg transition-colors"
          />
        </div>
        <div className="text-right shrink-0">
          <span className="block font-label-caps text-on-surface-variant mb-1">Total</span>
          <span className="font-headline-md text-primary font-bold">{draftTotalDistance(draft)}m</span>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {draft.drills.map((drill, index) => (
          <DraftDrillCard
            key={index}
            drill={drill}
            index={index}
            count={draft.drills.length}
            onChange={(next) => replaceDrill(index, next)}
            onRemove={() => removeDrill(index)}
            onMove={(direction) => moveDrill(index, direction)}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label="Add drill"
        onClick={addDrill}
        disabled={draft.drills.length >= maxDrills}
        className="mt-3 self-start text-xs text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none disabled:opacity-40"
      >
        <Icon name="add_circle" size="sm" />
        Add drill
      </button>

      {problem && (
        <div className="mt-4 flex items-center gap-2 text-label-sm text-error bg-error-container/20 px-3 py-2 rounded-lg">
          <Icon name="error" size="sm" />
          {problem}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-outline-variant">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || validation.ok === false}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold disabled:opacity-50"
        >
          {saving ? <Icon name="hourglass_empty" /> : <Icon name="check" />}
          Save session
        </button>
        <button
          type="button"
          aria-label="Discard proposal"
          onClick={onDiscard}
          disabled={saving}
          className="px-6 py-3 border-2 border-outline text-on-surface rounded-xl font-bold disabled:opacity-50"
        >
          Discard
        </button>
      </div>
    </div>
  )
}