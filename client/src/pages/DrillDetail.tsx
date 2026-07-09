import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDrill } from '../api/drills'
import { getSession } from '../api/sessions'
import type { Drill } from '../api/drills'
import type { Session } from '../api/sessions'

const strokeColors: Record<string, string> = {
  freestyle: 'bg-blue-100 text-blue-700',
  backstroke: 'bg-emerald-100 text-emerald-700',
  breaststroke: 'bg-purple-100 text-purple-700',
  butterfly: 'bg-pink-100 text-pink-700',
  im: 'bg-amber-100 text-amber-700',
}

export const DrillDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [drill, setDrill] = useState<Drill | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!id) return
      const d = await getDrill(id)
      if (!d) { setLoading(false); return }
      setDrill(d)
      const s = await getSession(d.session_id) ?? null
      setSession(s)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">Loading...</p>
    </div>
  )
  if (!drill) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">Drill not found.</p>
    </div>
  )

  return (
    <div>
      <button
        onClick={() => navigate(`/sessions/${drill.session_id}`)}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-4 font-body-md cursor-pointer bg-transparent border-none"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Back to Template
      </button>

      <div className="bg-surface-container-lowest rounded-xl p-5 md:p-6 border border-outline-variant mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-container/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-primary">swim</span>
          </div>
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">{drill.name}</h1>
            <span className={`inline-block mt-1 ${strokeColors[drill.stroke] || 'bg-surface-variant text-on-surface-variant'} text-[10px] font-bold px-2 py-0.5 rounded-full`}>
              {drill.stroke}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-surface-container-low p-3 rounded-xl">
            <span className="block font-label-caps text-label-caps text-on-surface-variant">Distance</span>
            <span className="font-headline-md text-headline-md text-primary font-bold">{drill.distance}m</span>
          </div>
          <div className="bg-surface-container-low p-3 rounded-xl">
            <span className="block font-label-caps text-label-caps text-on-surface-variant">Order</span>
            <span className="font-headline-md text-headline-md text-primary font-bold">#{drill.order + 1}</span>
          </div>
        </div>

        {session && (
          <div className="mt-6 pt-4 border-t border-outline-variant">
            <p className="font-label-sm text-label-sm text-on-surface-variant">Part of template:</p>
            <button
              onClick={() => navigate(`/sessions/${session.id}`)}
              className="mt-1 text-primary font-bold hover:underline bg-transparent border-none cursor-pointer"
            >
              {session.name}
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 md:p-6 border border-outline-variant">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary">info</span>
          <h3 className="font-headline-md text-headline-md text-on-surface">Lap Recording</h3>
        </div>
        <p className="text-on-surface-variant font-body-md">
          Laps are recorded during live sessions. Go to the <strong>Live View</strong> to start a session and record lap times for this drill.
        </p>
        <button
          onClick={() => navigate('/live')}
          className="mt-4 h-12 px-6 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined">timer</span>
          Go to Live View
        </button>
      </div>
    </div>
  )
}
