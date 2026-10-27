import { DraftItemRow } from './DraftItemRow'
import { SessionModalShell } from '../session/SessionModalShell'
import { Icon } from '../Icon'
import { draftDrillDistance } from '../../services/sessionDraft/apply'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config'
import type { SessionDraftDrillV1 } from '../../../../shared/sessionDraft/types'

interface DraftDrillModalProps {
  index: number
  drill: SessionDraftDrillV1
  onChange: (drill: SessionDraftDrillV1) => void
  onClose: () => void
}

// Fine-grained editing for a proposed drill. The panel shows the compact
// drill-list rows; this modal carries the full draft-contract field set.
export function DraftDrillModal({ index, drill, onChange, onClose }: DraftDrillModalProps) {
  const { maxStepsPerDrill, maxRepeatCount } = defaultSessionDraftConfig.limits

  return (
    <SessionModalShell title={`Edit drill ${index + 1}`} onClose={onClose}>
      <div className="p-4 md:px-6 md:pb-6 space-y-4">
        <div>
          <label htmlFor={`draft-drill-name-${index}`} className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Drill {index + 1} name</label>
          <input
            id={`draft-drill-name-${index}`}
            type="text"
            aria-label={`Drill name ${index + 1}`}
            value={drill.name}
            onChange={(e) => onChange({ ...drill, name: e.target.value })}
            className="w-full min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="block font-label-caps text-on-surface-variant mb-1">Set repeats</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={`Decrease set repeats for ${drill.name}`}
                onClick={() => onChange({ ...drill, repeatCount: Math.max(1, drill.repeatCount - 1) })}
                className="h-11 w-11 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-surface-variant transition-colors bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon name="remove" size="sm" />
              </button>
              <span className="font-bold text-lg w-10 text-center">{drill.repeatCount}x</span>
              <button
                type="button"
                aria-label={`Increase set repeats for ${drill.name}`}
                onClick={() =>
                  onChange({ ...drill, repeatCount: Math.min(maxRepeatCount, drill.repeatCount + 1) })
                }
                className="h-11 w-11 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-surface-variant transition-colors bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon name="add" size="sm" />
              </button>
            </div>
          </div>
          <div className="text-right">
            <span className="block font-label-caps text-on-surface-variant mb-1">Set distance</span>
            <span className="font-headline-md text-primary font-bold">
              {draftDrillDistance(drill.items, drill.repeatCount)}m
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {drill.items.map((item, itemIndex) => (
            <DraftItemRow
              key={itemIndex}
              item={item}
              drillName={drill.name}
              stepNumber={itemIndex + 1}
              stepCount={drill.items.length}
              onChange={(next) => {
                const items = [...drill.items]
                items[itemIndex] = next
                onChange({ ...drill, items })
              }}
              onRemove={() => onChange({ ...drill, items: drill.items.filter((_, i) => i !== itemIndex) })}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={`Add step to ${drill.name}`}
            onClick={() =>
              onChange({
                ...drill,
                items: [...drill.items, { distance: 100, stroke: 'freestyle', repeatCount: 1 }],
              })
            }
            disabled={drill.items.length >= maxStepsPerDrill}
            className="h-11 min-w-[44px] text-label-sm text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            + Add step
          </button>
        </div>
      </div>
    </SessionModalShell>
  )
}
