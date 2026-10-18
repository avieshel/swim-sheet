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
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <label className="block font-label-caps text-on-surface-variant mb-1">Drill {index + 1} name</label>
          <input
            type="text"
            aria-label={`Drill name ${index + 1}`}
            value={drill.name}
            onChange={(e) => onChange({ ...drill, name: e.target.value })}
            className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary px-2 py-1.5 text-sm outline-none rounded-t-lg transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 pt-5">
          <button
            type="button"
            aria-label={`Move drill ${index + 1} up`}
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-primary disabled:opacity-0 transition-all cursor-pointer bg-transparent border-none"
          >
            <Icon name="arrow_upward" size="sm" />
          </button>
          <button
            type="button"
            aria-label={`Move drill ${index + 1} down`}
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-primary disabled:opacity-0 transition-all cursor-pointer bg-transparent border-none"
          >
            <Icon name="arrow_downward" size="sm" />
          </button>
          <button
            type="button"
            aria-label={`Remove drill ${index + 1}`}
            onClick={onRemove}
            disabled={count === 1}
            className="w-8 h-8 flex items-center justify-center text-outline hover:text-error disabled:opacity-0 transition-all cursor-pointer bg-transparent border-none"
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
              className="w-9 h-9 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-surface-variant transition-colors bg-transparent"
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
              className="w-9 h-9 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-surface-variant transition-colors bg-transparent"
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
        className="mt-3 text-xs text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none disabled:opacity-40"
      >
        <Icon name="add_circle" size="sm" />
        Add step
      </button>
    </div>
  )
}