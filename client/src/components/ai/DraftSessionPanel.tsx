import { Icon } from '../Icon'
import { SessionEditorSection } from '../session/SessionEditorSection'
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
    <SessionEditorSection
      title="Proposed session"
      summary={`${draft.drills.length} drills`}
      actions={
        <div className="rounded-xl bg-primary/5 px-3 py-2 text-right">
          <span className="block font-label-caps text-on-surface-variant mb-0.5">Total distance</span>
          <span className="font-headline-md text-primary font-bold tabular-nums">{draftTotalDistance(draft)}m</span>
        </div>
      }
      className="flex flex-col p-4 md:p-5"
    >
      <div className="mb-4">
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
        className="mt-3 h-11 min-w-[44px] self-start text-label-sm text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none disabled:opacity-40"
      >
        <Icon name="add_circle" size="sm" />
        Add drill
      </button>

      {problem && (
        <div className="mt-4 flex items-center gap-2 text-label-sm text-error bg-error-container/20 px-3 py-2 rounded-xl" role="alert">
          <Icon name="error" size="sm" />
          {problem}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5 pt-4 border-t border-outline-variant">
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
    </SessionEditorSection>
  )
}
