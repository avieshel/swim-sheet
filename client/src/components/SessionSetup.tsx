import React, { useEffect, useState } from 'react'
import { listSwimmers } from '../api/swimmers'
import { listSessions, getSession } from '../api/sessions'
import { getActiveRun, completeRun, createRunFromTemplate, addSwimmerToRun } from '../api/runs'
import type { Session } from '../api/sessions'
import type { Swimmer as DbSwimmer } from '../api/runs'

export function SessionSetup({ onStart }: { onStart: () => void }) {
  const [templates, setTemplates] = useState<Session[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formPoolName, setFormPoolName] = useState('')
  const [formPoolLength, setFormPoolLength] = useState('25')
  const [poolLengthOption, setPoolLengthOption] = useState<'25' | '50' | 'custom'>('25')
  const [customPoolLength, setCustomPoolLength] = useState('')
  const [allSwimmers, setAllSwimmers] = useState<DbSwimmer[]>([])
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [laneCount, setLaneCount] = useState(8)

  useEffect(() => {
    Promise.all([listSessions(), listSwimmers()]).then(([sessions, swimmers]) => {
      setTemplates(sessions)
      setAllSwimmers(swimmers)
      setLoading(false)
    })
  }, [])

  const handleTemplateSelect = async (id: string) => {
    setSelectedTemplateId(id)
    const session = await getSession(id)
    if (session) {
      const length = String(session.poolLength)
      setFormPoolLength(length)
      if (length === '25') {
        setPoolLengthOption('25')
      } else if (length === '50') {
        setPoolLengthOption('50')
      } else {
        setPoolLengthOption('custom')
        setCustomPoolLength(length)
      }
    }
  }

  const toggleSwimmer = (swimmerId: string, lane: number) => {
    setAssignments(prev => {
      const next = { ...prev }
      if (next[swimmerId] === lane) {
        delete next[swimmerId]
      } else {
        next[swimmerId] = lane
      }
      return next
    })
  }

  const handleStart = async () => {
    if (!selectedTemplateId) return
    const existing = await getActiveRun()
    if (existing) await completeRun(existing.id)

    const runId = await createRunFromTemplate(selectedTemplateId, {
      date: formDate,
      poolName: formPoolName || 'Unnamed Pool',
      poolLength: Number(formPoolLength) || 25,
    })

    for (const [swimmerId, lane] of Object.entries(assignments)) {
      await addSwimmerToRun(runId, swimmerId, lane)
    }

    onStart()
  }

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-on-surface-variant">Loading...</p></div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="material-symbols-outlined text-5xl text-primary mb-2">timer</span>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Start a Session</h2>
        <p className="text-on-surface-variant mt-1">Choose a template, configure the pool, and assign swimmers to lanes.</p>
      </div>

      {/* Template Picker */}
      <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant mb-4">
        <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">Session Template</label>
        {templates.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No templates yet. Create one in the Sessions page first.</p>
        ) : (
          <div className="r-grid" style={{ '--grid-min': '200px', '--grid-gap': '0.5rem' } as React.CSSProperties}>
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleTemplateSelect(t.id)}
                className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedTemplateId === t.id
                    ? 'border-primary bg-primary-container/20'
                    : 'border-outline-variant hover:border-primary/50 bg-surface-container-low'
                }`}
              >
                <span className="font-bold text-on-surface block">{t.name}</span>
                <span className="text-label-sm text-on-surface-variant">{t.poolLength}m default pool</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Run Config */}
      <div className="bg-surface-container-lowest rounded-xl p-4 md:p-5 border border-outline-variant mb-4">
        <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Session Details</h3>
        <div className="r-grid" style={{ '--grid-min': '180px', '--grid-gap': 'clamp(0.5rem, 2vw, 1rem)' } as React.CSSProperties}>
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Date</label>
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
            />
          </div>
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Pool Name</label>
            <input
              type="text"
              value={formPoolName}
              onChange={e => setFormPoolName(e.target.value)}
              placeholder="e.g. Olympic Pool"
              className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
            />
          </div>
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Pool Length (m)</label>
            <select
              value={poolLengthOption}
              onChange={e => {
                setPoolLengthOption(e.target.value as "25" | "50" | "custom");
                if (e.target.value !== 'custom') {
                  setFormPoolLength(e.target.value);
                  setCustomPoolLength('');
                }
              }}
              className="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
            >
              <option value="25">25m (default)</option>
              <option value="50">50m</option>
              <option value="custom">Custom</option>
            </select>
            {poolLengthOption === 'custom' && (
              <input
                type="number"
                value={customPoolLength}
                onChange={e => {
                  setCustomPoolLength(e.target.value);
                  setFormPoolLength(e.target.value);
                }}
                placeholder="Enter length (m)"
                className="w-full mt-2 bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md outline-none rounded-t-lg"
              />
            )}
          </div>
        </div>
      </div>

      {/* Swimmer Assignment */}
      <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant mb-6">
        <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Assign Swimmers to Lanes</h3>
        {allSwimmers.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No swimmers in the roster. Add swimmers first.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allSwimmers.map(sw => (
              <div key={sw.id} className="flex items-center justify-between p-2 bg-surface-container-low rounded-lg">
                <span className="font-body-md text-body-md text-on-surface">{sw.name}</span>
                <div className="flex items-center gap-1">
                  <select
                    value={assignments[sw.id] ?? ''}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '') {
                        setAssignments(prev => { const n = { ...prev }; delete n[sw.id]; return n })
                      } else {
                        toggleSwimmer(sw.id, Number(val))
                      }
                    }}
                    className="md:hidden w-14 h-8 rounded-lg text-xs font-bold bg-surface-container-highest text-on-surface-variant border border-outline-variant px-1 cursor-pointer"
                  >
                    <option value="">Lane</option>
                    {Array.from({ length: laneCount }, (_, i) => i + 1).map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <div className="hidden md:flex gap-1 flex-wrap justify-end">
                    {Array.from({ length: laneCount }, (_, i) => i + 1).map(lane => (
                      <button
                        key={lane}
                        onClick={() => toggleSwimmer(sw.id, lane)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          assignments[sw.id] === lane
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-highest text-on-surface-variant hover:bg-primary-container/30'
                        }`}
                      >
                        {lane}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setLaneCount(laneCount + 1)}
                    className="w-8 h-8 rounded-lg text-xs font-bold bg-surface-container-highest text-on-surface-variant hover:bg-primary-container/30 transition-all cursor-pointer border border-dashed border-outline-variant flex items-center justify-center"
                    title="Add lane"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {Object.keys(assignments).length > 0 && (
          <p className="text-label-sm text-on-surface-variant mt-2">{Object.keys(assignments).length} swimmers assigned</p>
        )}
      </div>

      <button
        onClick={handleStart}
        disabled={!selectedTemplateId}
        className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-primary/20"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
        Start Session
      </button>
    </div>
  )
}
