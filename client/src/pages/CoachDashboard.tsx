import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSwimmers } from '../api/swimmers'
import { listSessions, listCompletedRuns } from '../api/sessions'
import { getRunDrill, getAllLaps } from '../api/runs'

export const CoachDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    templateCount: 0,
    swimmerCount: 0,
    completedRunCount: 0,
    lapCount: 0,
    totalDistance: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const templates = await listSessions()
      const swimmers = await listSwimmers()
      const laps = await getAllLaps()
      const completed = await listCompletedRuns()

      let totalDistance = 0
      for (const lap of laps) {
        try {
          const runDrill = await getRunDrill(lap.run_drill_id)
          if (runDrill) totalDistance += runDrill.distance
        } catch {
          // lap may have no matching run drill
        }
      }

      setStats({
        templateCount: templates.length,
        swimmerCount: swimmers.length,
        completedRunCount: completed.length,
        lapCount: laps.length,
        totalDistance,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">Loading dashboard...</p>
    </div>
  )

  return (
    <div>
      {/* Hero Section */}
      <section className="mb-stack-lg">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#00677f] to-[#00d1ff] p-6 md:p-8 text-on-primary shadow-lg group">
          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <span className="material-symbols-outlined text-[120px]">water_drop</span>
          </div>
          <div className="relative z-10">
            <span className="font-label-caps bg-white/20 px-3 py-1 rounded-full backdrop-blur-md mb-4 inline-block">
              Coach Dashboard
            </span>
            <h2 className="font-headline-lg text-headline-lg mb-2">Ready to Coach</h2>
            <p className="font-body-lg text-body-lg opacity-90 max-w-xl mb-6">
              {stats.templateCount} templates ready &middot; {stats.swimmerCount} swimmers in the roster
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <Link
                to="/live"
                className="bg-surface-container-lowest text-primary font-bold px-8 py-4 rounded-xl flex items-center gap-2 hover:shadow-xl active:scale-95 transition-all no-underline"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                Quick Start Live
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Hub Tiles — intrinsic auto-fit grid */}
      <section className="r-grid mb-stack-lg" style={{ '--grid-min': '280px' } as React.CSSProperties}>
        <Link
          to="/swimmers"
          className="group relative flex flex-col justify-between bg-surface-container-lowest p-6 md:p-8 rounded-[2rem] border border-outline-variant hover:border-primary transition-all duration-300 shadow-sm hover:shadow-xl no-underline"
        >
          <div className="mb-6 md:mb-8">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-secondary-container flex items-center justify-center text-on-secondary-container mb-4 md:mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-2xl md:text-3xl">groups</span>
            </div>
            <h3 className="font-headline-md text-on-surface mb-1 md:mb-2">Team Management</h3>
            <p className="text-on-surface-variant font-body-md">
              Manage {stats.swimmerCount} active swimmers, track attendance, and view performance history.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-primary font-bold">Go to Swimmers</span>
            <span className="material-symbols-outlined text-primary group-hover:translate-x-2 transition-transform">arrow_forward</span>
          </div>
        </Link>

        <Link
          to="/sessions"
          className="group relative flex flex-col justify-between bg-surface-container-lowest p-6 md:p-8 rounded-[2rem] border border-outline-variant hover:border-primary transition-all duration-300 shadow-sm hover:shadow-xl no-underline"
        >
          <div className="mb-6 md:mb-8">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary-container/30 flex items-center justify-center text-primary mb-4 md:mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-2xl md:text-3xl">event_note</span>
            </div>
            <h3 className="font-headline-md text-on-surface mb-1 md:mb-2">Session Planner</h3>
            <p className="text-on-surface-variant font-body-md">
              Design training templates with the Drill Library. {stats.templateCount} templates saved.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-primary font-bold">Plan Next Set</span>
            <span className="material-symbols-outlined text-primary group-hover:translate-x-2 transition-transform">arrow_forward</span>
          </div>
        </Link>

        <Link
          to="/live"
          className="group relative flex flex-col justify-between bg-inverse-surface p-6 md:p-8 rounded-[2rem] transition-all duration-300 shadow-sm hover:shadow-2xl no-underline"
        >
          <div className="mb-6 md:mb-8">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary flex items-center justify-center text-white mb-4 md:mb-6 group-hover:scale-110 transition-transform animate-pulse">
              <span className="material-symbols-outlined text-2xl md:text-3xl">timer</span>
            </div>
            <h3 className="font-headline-md text-white mb-1 md:mb-2">Active Deck</h3>
            <p className="text-outline-variant font-body-md">
              Enter live coaching mode. Choose a template, assign lanes, and track splits.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-primary-fixed-dim font-bold">Launch Deck</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
              <span className="material-symbols-outlined text-primary-fixed-dim group-hover:translate-x-2 transition-transform">arrow_forward</span>
            </div>
          </div>
        </Link>
      </section>

      {/* Bento Stats Grid — intrinsic grid with minmax */}
      <div className="r-grid" style={{ '--grid-min': '200px' } as React.CSSProperties}>
        <div className="bg-surface-variant/30 p-5 md:p-6 rounded-3xl border border-outline-variant/50" style={{ gridColumn: 'span 2' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-label-caps text-on-surface-variant">Total Distance Recorded</h4>
            <span className="text-primary font-bold">{stats.totalDistance}m</span>
          </div>
          <div className="flex items-end gap-2 h-20 md:h-32 mb-4">
            {[40, 60, 55, 85, 100, 70, 45].map((h, i) => (
              <div key={i} className={`flex-1 rounded-t-lg ${i === 4 ? 'bg-primary' : 'bg-primary/20'}`} style={{ height: `${h}%` }} />
            ))}
          </div>
          <p className="text-on-surface-variant font-label-sm">Training volume across all completed sessions</p>
        </div>

        <div className="bg-surface-container-high p-5 md:p-6 rounded-3xl border border-outline-variant/50 flex flex-col justify-between">
          <h4 className="font-label-caps text-on-surface-variant mb-2">Team Status</h4>
          <div>
            <div className="text-headline-lg font-headline-lg text-primary">{stats.swimmerCount}</div>
            <p className="text-on-surface-variant font-body-md">Registered Swimmers</p>
          </div>
        </div>

        <div className="bg-secondary-fixed p-5 md:p-6 rounded-3xl border border-outline-variant/50 flex flex-col justify-between">
          <h4 className="font-label-caps text-on-secondary-fixed-variant mb-2">Completed Sessions</h4>
          <div>
            <div className="text-headline-md font-headline-md text-on-secondary-fixed">{stats.completedRunCount}</div>
            <p className="text-on-secondary-fixed-variant font-body-md">Training Runs Completed</p>
          </div>
          <div className="mt-4">
            <div className="w-full bg-on-secondary-fixed/10 h-2 rounded-full overflow-hidden">
              <div className="bg-on-secondary-fixed h-full" style={{ width: `${Math.min(100, stats.completedRunCount * 20)}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
