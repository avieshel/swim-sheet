import { useState } from 'react'
import { EquipmentIcons, type EquipmentType } from './EquipmentIcons'
import { CustomSelect } from './CustomSelect'
import { EQUIPMENT_OPTIONS, TECHNIQUE_LABELS, FITNESS_LABELS, PHASE_LABELS, strokeOptions } from '../constants/drill'
import { getDrillTotalDistance } from '../utils/drillHelpers'

export interface DrillItem {
  id: string
  distance: number
  stroke: string
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
  tag?: 'warmup' | 'main-set' | 'cooldown'
  id?: string
  distance?: number
  stroke?: string
  order?: number
  session_id?: string
}

interface DrillEditorModalProps {
  open: boolean
  title: string
  initialData?: Partial<DrillFormData>
  onSave: (data: DrillFormData) => void
  onDelete?: () => void
  onClose: () => void
  showTags?: boolean
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
      tag: initialData.tag,
      id: initialData.id,
      distance: initialData.distance,
      stroke: initialData.stroke,
      order: initialData.order,
      session_id: initialData.session_id,
    }
  }
  return {
    name: '',
    items: [{ id: crypto.randomUUID(), distance: 100, stroke: 'freestyle', repeatCount: 1 }],
    repeatCount: 1,
    timingMode: 'individual',
    focus: 'none',
    labels: [],
    description: '',
    tag: undefined,
  }
}

export const DrillEditorModal: React.FC<DrillEditorModalProps> = ({ open, title, initialData, onSave, onDelete, onClose, showTags }) => {
  const [form, setForm] = useState<DrillFormData>(() => defaultForm(initialData))

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-[min(95vw, 56rem)] max-h-[95vh] overflow-y-auto shadow-2xl border border-outline-variant animate-fade-in">
        <div className="p-4 md:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-headline-md text-on-surface m-0">{title}</h2>
            <button onClick={onClose} className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors cursor-pointer bg-transparent border-none">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <label className="block font-label-caps text-on-surface-variant mb-2">Drill Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Pyramid Set or 8x100m Progression"
                className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary p-3 font-body-lg outline-none rounded-t-lg"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-label-caps text-on-surface-variant mb-2">Description / Instructions</label>
              <textarea
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. 6-1-6 breathing: 6 kicks on side, 1 stroke, 6 kicks on other side..."
                rows={2}
                className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary p-3 font-body-md outline-none rounded-t-lg resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-label-caps text-on-surface-variant mb-2">Total Set Repeats</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setForm({ ...form, repeatCount: Math.max(1, (form.repeatCount || 1) - 1) })} className="w-10 h-10 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-surface-variant transition-colors">-</button>
                  <span className="font-bold text-lg w-8 text-center">{form.repeatCount}x</span>
                  <button onClick={() => setForm({ ...form, repeatCount: (form.repeatCount || 1) + 1 })} className="w-10 h-10 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-surface-variant transition-colors">+</button>
                </div>
              </div>
              <div>
                <label className="block font-label-caps text-on-surface-variant mb-2">Timing Mode</label>
                <div className="flex bg-surface-container-low p-1 rounded-lg">
                  <button
                    onClick={() => setForm({ ...form, timingMode: 'individual' })}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${form.timingMode === 'individual' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Individual
                  </button>
                  <button
                    onClick={() => setForm({ ...form, timingMode: 'continuous' })}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${form.timingMode === 'continuous' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Continuous
                  </button>
                </div>
              </div>
              <div className="flex flex-col justify-center items-center sm:items-end">
                <span className="font-label-caps text-on-surface-variant mb-1">Set Distance</span>
                <span className="font-headline-md text-primary font-bold">{getDrillTotalDistance(form)}m</span>
              </div>
            </div>

            {/* Phase & Focus */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block font-label-caps text-on-surface-variant mb-2">Session Phase</label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-surface-container-low rounded-xl border border-outline-variant/30">
                  {PHASE_LABELS.map(label => {
                    const active = form.labels?.includes(label)
                    return (
                      <button
                        key={label}
                        onClick={() => {
                          const labels = form.labels || []
                          setForm({
                            ...form,
                            labels: active ? labels.filter(l => l !== label) : [...labels, label]
                          })
                        }}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${active ? 'bg-secondary text-on-secondary' : 'bg-surface-container-highest text-on-surface-variant hover:bg-outline-variant'}`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block font-label-caps text-on-surface-variant mb-2">Primary Focus</label>
                <div className="flex gap-2 mb-3">
                  {['none', 'technique', 'fitness'].map(f => (
                    <button
                      key={f}
                      onClick={() => setForm({ ...form, focus: f, labels: (form.labels || []).filter(l => !TECHNIQUE_LABELS.includes(l) && !FITNESS_LABELS.includes(l)) })}
                      className={`flex-1 py-2 rounded-full border text-xs font-bold capitalize transition-all cursor-pointer ${form.focus === f ? 'bg-primary-container text-on-primary-container border-primary' : 'border-outline text-on-surface-variant'}`}
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
                          onClick={() => {
                            const labels = form.labels || []
                            setForm({
                              ...form,
                              labels: active ? labels.filter(l => l !== label) : [...labels, label]
                            })
                          }}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${active ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant hover:bg-outline-variant'}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {showTags && (
              <div>
                <label className="block font-label-caps text-on-surface-variant mb-2">Session Role / Tag</label>
                <div className="flex gap-2">
                  {(['warmup', 'main-set', 'cooldown'] as const).map(t => {
                    const active = form.tag === t
                    return (
                      <button
                        key={t}
                        onClick={() => setForm({ ...form, tag: active ? undefined : t })}
                        className={`flex-1 py-2 rounded-full border text-xs font-bold capitalize transition-all cursor-pointer ${active ? 'bg-primary text-on-primary border-primary' : 'border-outline text-on-surface-variant'}`}
                      >
                        {t === 'main-set' ? 'Main Set' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Items List */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-label-caps text-on-surface-variant">Set Components</label>
                <button
                  onClick={() => setForm({
                    ...form,
                    items: [...(form.items || []), { id: crypto.randomUUID(), distance: 100, stroke: 'freestyle', repeatCount: 1 }]
                  })}
                  className="text-xs text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-none"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Add Step
                </button>
              </div>
              <div className="space-y-3">
                {(form.items || []).map((item, idx) => (
                  <div key={item.id} className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 relative group">
                    <div className="flex flex-wrap md:flex-nowrap items-end gap-3">
                      <div className="w-16 shrink-0">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Reps</label>
                        <input
                          type="number"
                          min="1"
                          value={item.repeatCount}
                          onChange={e => {
                            const newItems = [...(form.items || [])]
                            newItems[idx] = { ...item, repeatCount: parseInt(e.target.value) || 1 }
                            setForm({ ...form, items: newItems })
                          }}
                          className="w-full bg-surface-container-lowest border-b-2 border-outline focus:border-primary px-1.5 py-1.5 text-sm outline-none rounded-t-md transition-colors"
                        />
                      </div>
                      <div className="w-24 shrink-0">
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
                      <div className="flex-1 min-w-[100px]">
                        <CustomSelect
                          label="Stroke"
                          value={item.stroke}
                          options={strokeOptions}
                          onChange={(val) => {
                            const newItems = [...(form.items || [])]
                            newItems[idx] = { ...item, stroke: val as string }
                            setForm({ ...form, items: newItems })
                          }}
                        />
                      </div>
                      <div className="w-20 shrink-0">
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
                      <div className="w-20 shrink-0">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Interval</label>
                        <input
                          type="text"
                          value={item.interval || ''}
                          onChange={e => {
                            const newItems = [...(form.items || [])]
                            newItems[idx] = { ...item, interval: e.target.value }
                            setForm({ ...form, items: newItems })
                          }}
                          placeholder="2:00"
                          className="w-full bg-surface-container-lowest border-b-2 border-outline focus:border-primary px-1.5 py-1.5 text-sm outline-none rounded-t-md transition-colors"
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pb-1 flex-wrap">
                        {EQUIPMENT_OPTIONS.map(opt => {
                          const active = item.equipment?.includes(opt.id)
                          return (
                            <button
                              key={opt.id}
                              title={opt.label}
                              onClick={() => {
                                const newItems = [...(form.items || [])]
                                const equipment = item.equipment || []
                                newItems[idx] = {
                                  ...item,
                                  equipment: active ? equipment.filter(e => e !== opt.id) : [...equipment, opt.id]
                                }
                                setForm({ ...form, items: newItems })
                              }}
                              className={`min-w-[44px] min-h-[44px] rounded-lg flex flex-col items-center justify-center transition-all border cursor-pointer ${active ? 'bg-secondary text-on-secondary border-secondary shadow-sm' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/30 hover:bg-outline-variant'}`}
                            >
                              <EquipmentIcons type={opt.id as EquipmentType} className="w-4 h-4 mb-0.5" />
                              <span className="text-[7px] font-bold uppercase tracking-tighter leading-none">{opt.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      <div className="shrink-0 pb-1">
                        <button
                          onClick={() => {
                            const newItems = (form.items || []).filter((_, i) => i !== idx)
                            setForm({ ...form, items: newItems })
                          }}
                          disabled={(form.items || []).length === 1}
                          className="w-8 h-8 flex items-center justify-center text-outline hover:text-error disabled:opacity-0 transition-all cursor-pointer bg-transparent border-none"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-outline-variant">
              <button
                onClick={() => onSave(form)}
                className="flex-1 h-14 bg-primary text-on-primary rounded-xl font-bold text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer"
              >
                {form.id ? 'Save Changes' : 'Create Drill'}
              </button>
              <button
                onClick={onClose}
                className="px-6 h-14 border-2 border-outline text-on-surface rounded-xl font-bold hover:bg-surface-variant transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>

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
      </div>
    </div>
  )
}
