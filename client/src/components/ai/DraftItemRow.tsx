import { CustomSelect } from '../CustomSelect'
import { DraftNumberInput } from './DraftNumberInput'
import { EquipmentIcons, type EquipmentType } from '../EquipmentIcons'
import { EQUIPMENT_OPTIONS, strokeOptions } from '../../constants/drill'
import { Icon } from '../Icon'
import {
  EQUIPMENT_IDS,
  INTENSITY_VALUES,
  defaultSessionDraftConfig,
} from '../../../../shared/sessionDraft/config'
import type { IntensityV1, SessionDraftItemV1, Stroke } from '../../../../shared/sessionDraft/types'

const INTENSITY_OPTIONS = [
  { value: '', label: '--' },
  ...INTENSITY_VALUES.map((value) => ({ value, label: value })),
]

// Driven by the contract allowlist, not the UI list, so an equipment id the
// validator accepts can never be missing from the panel.
const EQUIPMENT_LABELS = new Map(EQUIPMENT_OPTIONS.map((option) => [option.id, option.label]))
const EQUIPMENT_CHOICES = EQUIPMENT_IDS.map((id) => ({ id, label: EQUIPMENT_LABELS.get(id) ?? id }))

interface DraftItemRowProps {
  item: SessionDraftItemV1
  drillName: string
  stepNumber: number
  stepCount: number
  onChange: (item: SessionDraftItemV1) => void
  onRemove: () => void
}

export function DraftItemRow({ item, drillName, stepNumber, stepCount, onChange, onRemove }: DraftItemRowProps) {
  const { maxDistance, maxRepeatCount } = defaultSessionDraftConfig.limits

  return (
    <div className="p-3 md:p-4 bg-surface-container-low rounded-xl border border-outline-variant/30">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-16 shrink-0">
          <label className="block text-label-sm font-bold text-on-surface-variant uppercase mb-1">Reps</label>
          <DraftNumberInput
            value={item.repeatCount}
            min={1}
            max={maxRepeatCount}
            label={`Reps for ${drillName}`}
            onChange={(repeatCount) => onChange({ ...item, repeatCount })}
          />
        </div>

        <div className="w-20 shrink-0">
          <label className="block text-label-sm font-bold text-on-surface-variant uppercase mb-1">Dist</label>
          <DraftNumberInput
            value={item.distance}
            min={1}
            max={maxDistance}
            label={`Distance for ${drillName}`}
            onChange={(distance) => onChange({ ...item, distance })}
          />
        </div>

        <div className="w-32 shrink-0">
          <CustomSelect
            label="Stroke"
            value={item.stroke}
            options={strokeOptions}
            onChange={(value) => onChange({ ...item, stroke: value as Stroke })}
          />
        </div>

        <div className="w-16 shrink-0">
          <CustomSelect
            label="Int"
            value={item.intensity ?? ''}
            options={INTENSITY_OPTIONS}
            onChange={(value) =>
              onChange({ ...item, intensity: value === '' ? undefined : (value as IntensityV1) })
            }
          />
        </div>

        <div className="w-20 shrink-0">
          <label className="block text-label-sm font-bold text-on-surface-variant uppercase mb-1">Interval</label>
          <input
            type="text"
            aria-label={`Interval for ${drillName}`}
            placeholder="2:00"
            value={item.interval ?? ''}
            onChange={(e) => onChange({ ...item, interval: e.target.value })}
            className="w-full bg-surface-container-lowest border-b-2 border-outline focus:border-primary px-1.5 py-1.5 text-sm outline-none rounded-t-md transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 pb-1 flex-wrap">
          {EQUIPMENT_CHOICES.map((option) => {
            const active = item.equipment?.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                title={option.label}
                aria-pressed={Boolean(active)}
                onClick={() =>
                  onChange({
                    ...item,
                    equipment: active
                      ? (item.equipment ?? []).filter((id) => id !== option.id)
                      : [...(item.equipment ?? []), option.id],
                  })
                }
                className={`rounded-lg flex flex-col items-center justify-center transition-all border cursor-pointer ${
                  active
                    ? 'bg-secondary text-on-secondary border-secondary shadow-sm'
                    : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/30 hover:bg-outline-variant'
                }`}
              >
                <EquipmentIcons type={option.id as EquipmentType} className="w-4 h-4 mb-0.5" />
                <span className="text-caption font-bold uppercase tracking-tighter leading-none">{option.label}</span>
              </button>
            )
          })}
        </div>

        <div className="shrink-0 pb-1 ml-auto">
          <button
            type="button"
            aria-label={`Remove step ${stepNumber} from ${drillName}`}
            onClick={onRemove}
            disabled={stepCount === 1}
            className="w-8 h-8 flex items-center justify-center text-outline hover:text-error disabled:opacity-0 transition-all cursor-pointer bg-transparent border-none"
          >
            <Icon name="delete" size="lg" />
          </button>
        </div>
      </div>
    </div>
  )
}