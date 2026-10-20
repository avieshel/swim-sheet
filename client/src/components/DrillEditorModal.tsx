import { useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { EquipmentIcons, type EquipmentType } from './EquipmentIcons'
import { CustomSelect } from './CustomSelect'
import { SessionModalShell } from './session/SessionModalShell'
import { EQUIPMENT_OPTIONS, TECHNIQUE_LABELS, FITNESS_LABELS, PHASE_LABELS, strokeOptions } from '../constants/drill'
import { getDrillTotalDistance } from '../utils/drillHelpers'
import { emptyDrillForm } from '../utils/drillHelpers'
import { Icon } from './Icon'
import type { Stroke } from '../types/swimming'

interface DrillItem {
  id: string
  distance: number
  stroke: Stroke
  repeatCount: number
  intensity?: string
  interval?: string
  equipment?: string[]
}

export interface DrillFormData {
  name: string
  items: DrillItem[]
  repeatCount: number
  timingMode: 'individual' | 'continuous'
  focus: string
  labels: string[]
  description: string
  id?: string
  distance?: number
  stroke?: Stroke
  order?: number
  sessionId?: string
}

interface DrillEditorModalProps {
  open: boolean
  title: string
  initialData?: Partial<DrillFormData>
  onSave: (data: DrillFormData, asVariant?: boolean) => void
  onDelete?: () => void
  onClose: () => void
  restoreFocusRef?: RefObject<HTMLElement | null>
}

const defaultForm = (initialData?: Partial<DrillFormData>): DrillFormData => {
  if (initialData) {
    return {
      name: initialData.name || '',
      items: (initialData.items && initialData.items.length > 0) ? initialData.items : [{ id: crypto.randomUUID(), distance: 100, stroke: 'freestyle', repeatCount: 1 }],
      repeatCount: initialData.repeatCount ?? 1,
      timingMode: initialData.timingMode || 'individual',
      focus: initialData.focus || 'none',
      labels: initialData.labels || [],
      description: initialData.description || '',
      id: initialData.id,
      distance: initialData.distance,
      stroke: initialData.stroke,
      order: initialData.order,
      sessionId: initialData.sessionId,
    }
  }
  return {
    ...emptyDrillForm(),
  }
}

export const DrillEditorModal: React.FC<DrillEditorModalProps> = ({ open, title, initialData, onSave, onDelete, onClose, restoreFocusRef }) => {
  const [form, setForm] = useState<DrillFormData>(() => defaultForm(initialData))
  const [showStrokeConfirm, setShowStrokeConfirm] = useState(false)
  const [pendingSave, setPendingSave] = useState<DrillFormData | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const hasStrokeChanged = (): boolean => {
    if (!initialData?.stroke) return false
    const originalStroke = initialData.stroke
    return (form.items || []).some(item => item.stroke !== originalStroke)
  }

  const handleSave = () => {
    if (hasStrokeChanged()) {
      setPendingSave(form)
      setShowStrokeConfirm(true)
    } else {
      onSave(form)
    }
  }

  const handleStrokeConfirm = () => {
    setShowStrokeConfirm(false)
    if (pendingSave) {
      onSave(pendingSave, true)
      setPendingSave(null)
    }
  }

  const handleStrokeSkip = () => {
    setShowStrokeConfirm(false)
    setPendingSave(null)
  }

  const handleContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (showStrokeConfirm && event.key === 'Escape') {
      event.stopPropagation()
      handleStrokeSkip()
    }
  }

  if (!open) return null

  return (
    <SessionModalShell title={title} onClose={onClose} initialFocusRef={nameInputRef} restoreFocusRef={restoreFocusRef} size="wide">
        <div className="p-4 md:p-6 lg:p-8" onKeyDown={handleContentKeyDown}>
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <label htmlFor="drill-name" className="block font-label-caps text-label-caps text-on-surface-variant mb-2">Drill Name</label>
              <input
                ref={nameInputRef}
                id="drill-name"
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Pyramid Set or 8x100m Progression"
                className="w-full min-h-12 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label htmlFor="drill-description" className="block font-label-caps text-label-caps text-on-surface-variant mb-2">Description / Instructions</label>
              <textarea
                id="drill-description"
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. 6-1-6 breathing: 6 kicks on side, 1 stroke, 6 kicks on other side..."
                rows={2}
                className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">Total Set Repeats</label>
                <div className="flex items-center gap-3">
                  <button type="button" aria-label="Decrease total set repeats" onClick={() => setForm({ ...form, repeatCount: Math.max(1, (form.repeatCount || 1) - 1) })} className="h-11 w-11 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-surface-variant transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">-</button>
                  <span className="font-bold text-lg w-8 text-center">{form.repeatCount}x</span>
                  <button type="button" aria-label="Increase total set repeats" onClick={() => setForm({ ...form, repeatCount: (form.repeatCount || 1) + 1 })} className="h-11 w-11 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-surface-variant transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">+</button>
                </div>
              </div>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">Timing Mode</label>
                <div className="flex bg-surface-container-low p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, timingMode: 'individual' })}
                    aria-pressed={form.timingMode === 'individual'}
                    className={`flex-1 min-h-11 text-label-sm font-bold rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${form.timingMode === 'individual' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, timingMode: 'continuous' })}
                    aria-pressed={form.timingMode === 'continuous'}
                    className={`flex-1 min-h-11 text-label-sm font-bold rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${form.timingMode === 'continuous' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Continuous
                  </button>
                </div>
              </div>
              <div className="flex flex-col justify-center items-center sm:items-end">
                <span className="font-label-caps text-label-caps text-on-surface-variant mb-1">Set Distance</span>
                <span className="font-headline-md text-primary font-bold">{getDrillTotalDistance(form)}m</span>
              </div>
            </div>

            {/* Phase & Focus */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">Session Phase</label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-surface-container-low rounded-xl border border-outline-variant/30">
                  {PHASE_LABELS.map(label => {
                    const active = form.labels?.includes(label)
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          const labels = form.labels || []
                          setForm({
                            ...form,
                            labels: active ? labels.filter(l => l !== label) : [...labels, label]
                          })
                        }}
                        className={`min-h-11 px-3 rounded-full text-label-sm font-bold uppercase tracking-wider transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'bg-secondary text-on-secondary' : 'bg-surface-container-highest text-on-surface-variant hover:bg-outline-variant'}`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">Primary Focus</label>
                <div className="flex gap-2 mb-3">
                  {['none', 'technique', 'fitness'].map(f => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={form.focus === f}
                      onClick={() => setForm({ ...form, focus: f, labels: (form.labels || []).filter(l => !TECHNIQUE_LABELS.includes(l) && !FITNESS_LABELS.includes(l)) })}
                      className={`flex-1 min-h-11 rounded-full border text-label-sm font-bold capitalize transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${form.focus === f ? 'bg-primary-container text-on-primary-container border-primary' : 'border-outline text-on-surface-variant'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {form.focus !== 'none' && (
                  <div className="flex flex-wrap gap-1.5 p-3 bg-surface-container-low rounded-xl border border-outline-variant/30">
                    {(form.focus === 'technique' ? TECHNIQUE_LABELS : FITNESS_LABELS).map(label => {
                      const active = form.labels?.includes(label)
                      return (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            const labels = form.labels || []
                            setForm({
                              ...form,
                              labels: active ? labels.filter(l => l !== label) : [...labels, label]
                            })
                          }}
                          className={`min-h-11 px-3 rounded-full text-label-sm font-bold uppercase tracking-wider transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant hover:bg-outline-variant'}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Items List */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-label-caps text-label-caps text-on-surface-variant">Set Components</label>
                <button
                  type="button"
                  onClick={() => setForm({
                    ...form,
                    items: [...(form.items || []), { id: crypto.randomUUID(), distance: 100, stroke: 'freestyle', repeatCount: 1 }]
                  })}
                  className="h-11 min-w-[44px] text-label-sm text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Icon name="add_circle" size="sm" />
                  Add Step
                </button>
              </div>
              <div className="space-y-3">
                {(form.items || []).map((item, idx) => (
                  <div key={item.id} className="p-3 md:p-4 bg-surface-container-low/70 rounded-2xl border border-outline-variant/40 relative group">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-8 items-end gap-3">
                      <div className="min-w-0">
                        <label htmlFor={`drill-step-reps-${idx}`} className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Reps</label>
                        <input
                          id={`drill-step-reps-${idx}`}
                          type="number"
                          min="1"
                          value={item.repeatCount}
                          onChange={e => {
                            const newItems = [...(form.items || [])]
                            newItems[idx] = { ...item, repeatCount: parseInt(e.target.value) || 1 }
                            setForm({ ...form, items: newItems })
                          }}
                          className="w-full min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="min-w-0">
                        <CustomSelect
                          label="Dist (m)"
                          value={item.distance > 600 ? 'custom' : item.distance}
                          options={[
                            ...[25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 550, 600].map(v => ({ value: v, label: `${v}m` })),
                            { value: 'custom', label: item.distance > 600 ? `${item.distance}m` : 'Custom...' }
                          ]}
                          onChange={(val) => {
                            const newItems = [...(form.items || [])]
                            if (val === 'custom') {
                              const custom = prompt('Enter custom distance (m):', String(item.distance))
                              newItems[idx] = { ...item, distance: parseInt(custom || '0') || 0 }
                            } else {
                              newItems[idx] = { ...item, distance: val as number }
                            }
                            setForm({ ...form, items: newItems })
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <CustomSelect
                          label="Stroke"
                          value={item.stroke}
                          options={strokeOptions}
                          onChange={(val) => {
                            const newItems = [...(form.items || [])]
                            newItems[idx] = { ...item, stroke: val as Stroke }
                            setForm({ ...form, items: newItems })
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <CustomSelect
                          label="Int"
                          value={item.intensity || ''}
                          options={[
                            { value: '', label: '--' },
                            { value: 'v1', label: 'v1' },
                            { value: 'v2', label: 'v2' },
                            { value: 'v3', label: 'v3' },
                            { value: 'v4', label: 'v4' },
                          ]}
                          onChange={(val) => {
                            const newItems = [...(form.items || [])]
                            newItems[idx] = { ...item, intensity: val as string }
                            setForm({ ...form, items: newItems })
                          }}
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 min-w-0">
                        <label htmlFor={`drill-step-interval-${idx}`} className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Interval</label>
                        <input
                          id={`drill-step-interval-${idx}`}
                          type="text"
                          value={item.interval || ''}
                          onChange={e => {
                            const newItems = [...(form.items || [])]
                            newItems[idx] = { ...item, interval: e.target.value }
                            setForm({ ...form, items: newItems })
                          }}
                          placeholder="2:00"
                          className="w-full min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-3 xl:col-span-2 grid grid-cols-4 gap-1 pb-1">
                        {EQUIPMENT_OPTIONS.map(opt => {
                          const active = item.equipment?.includes(opt.id)
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              title={opt.label}
                              aria-pressed={Boolean(active)}
                              onClick={() => {
                                const newItems = [...(form.items || [])]
                                const equipment = item.equipment || []
                                newItems[idx] = {
                                  ...item,
                                  equipment: active ? equipment.filter(e => e !== opt.id) : [...equipment, opt.id]
                                }
                                setForm({ ...form, items: newItems })
                              }}
                              className={`min-h-11 min-w-[44px] rounded-xl flex flex-col items-center justify-center transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'bg-secondary text-on-secondary border-secondary shadow-sm' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/30 hover:bg-outline-variant'}`}
                            >
                              <EquipmentIcons type={opt.id as EquipmentType} className="w-4 h-4 mb-0.5" />
                              <span className="text-caption font-bold uppercase tracking-tighter leading-none">{opt.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      <div className="col-span-2 sm:col-span-3 xl:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = (form.items || []).filter((_, i) => i !== idx)
                            setForm({ ...form, items: newItems })
                          }}
                          disabled={(form.items || []).length === 1}
                          className="h-11 w-11 flex items-center justify-center rounded-xl text-outline hover:text-error hover:bg-error-container/20 disabled:opacity-40 transition-all cursor-pointer bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                        >
                          <Icon name="delete" size="lg" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-outline-variant">
               <button
                 onClick={handleSave}
                className="flex-1 min-h-12 bg-primary text-on-primary rounded-xl font-label-sm font-bold hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer border-none"
               >
                 {form.id ? 'Save Changes' : 'Create Drill'}
               </button>
               <button
                 onClick={onClose}
                  className="h-12 min-w-[44px] px-5 border border-outline text-on-surface rounded-xl font-label-sm font-bold hover:bg-surface-container-low transition-colors cursor-pointer bg-transparent"
               >
                 Cancel
               </button>
             </div>

             {/* Stroke-Change Confirmation */}
<ConfirmDialog
                 open={showStrokeConfirm}
                 title="Stroke Changed"
                 message="This drill has a different stroke than the original. Save as a new variant to bump its popularity ranking, or discard to undo your changes?"
                 onConfirm={handleStrokeConfirm}
                 onCancel={handleStrokeSkip}
                 confirmLabel="Save as New Variant"
                 cancelLabel="Discard"
                 destructive={false}
               />

            {onDelete && (
              <div className="pt-2 flex justify-center">
                <button
                  onClick={onDelete}
                  className="text-xs text-error font-bold hover:underline cursor-pointer bg-transparent border-none"
                >
                  Delete Drill
                </button>
              </div>
            )}
          </div>
        </div>
      </SessionModalShell>
  )
}
