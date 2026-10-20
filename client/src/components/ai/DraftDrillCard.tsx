import { Icon } from '../Icon'
import { DraftItemRow } from './DraftItemRow'
import { draftDrillDistance } from '../../services/sessionDraft/apply'
import { defaultSessionDraftConfig } from '../../../../shared/sessionDraft/config'
import type { SessionDraftDrillV1, SessionDraftItemV1 } from '../../../../shared/sessionDraft/types'

interface DraftDrillCardProps {
  drill: SessionDraftDrillV1
  index: number
  count: number
  onChange: (drill: SessionDraftDrillV1) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}

export function DraftDrillCard({ drill, index, count, onChange, onRemove, onMove }: DraftDrillCardProps) {
  const { maxItemsPerDrill, maxRepeatCount } = defaultSessionDraftConfig.limits

  const replaceItem = (itemIndex: number, item: SessionDraftItemV1) => {
    const items = [...drill.items]
    items[itemIndex] = item
    onChange({ ...drill, items })
  }

  const removeItem = (itemIndex: number) => {
    onChange({ ...drill, items: drill.items.filter((_, i) => i !== itemIndex) })
  }

  const addItem = () => {
    onChange({
      ...drill,
      items: [...drill.items, { distance: 100, stroke: 'freestyle', repeatCount: 1 }],
    })
  }

  return (
    <div className="bg-surface-container-low/50 rounded-2xl border border-outline-variant/70 p-3 md:p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
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
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            type="button"
            aria-label={`Move drill ${index + 1} up`}
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="h-11 w-11 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 disabled:opacity-40 transition-all cursor-pointer bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="arrow_upward" size="sm" />
          </button>
          <button
            type="button"
            aria-label={`Move drill ${index + 1} down`}
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className="h-11 w-11 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 disabled:opacity-40 transition-all cursor-pointer bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="arrow_downward" size="sm" />
          </button>
          <button
            type="button"
            aria-label={`Remove drill ${index + 1}`}
            onClick={onRemove}
            disabled={count === 1}
            className="h-11 w-11 flex items-center justify-center rounded-lg text-outline hover:text-error hover:bg-error-container/20 disabled:opacity-40 transition-all cursor-pointer bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
          >
            <Icon name="delete" size="lg" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-outline-variant/30">
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
            onChange={(next) => replaceItem(itemIndex, next)}
            onRemove={() => removeItem(itemIndex)}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label={`Add step to ${drill.name}`}
        onClick={addItem}
        disabled={drill.items.length >= maxItemsPerDrill}
          className="mt-3 h-11 min-w-[44px] text-label-sm text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="add_circle" size="sm" />
        Add step
      </button>
    </div>
  )
}
