import { useNavigate } from 'react-router-dom'
import { useCoachAssist } from '../context/coachAssistShared'
import { Icon } from '../components/Icon'

export function CoachAssistEntry() {
  const { isOwner, ownerLoading, coaches, coach, selectCoach, exit } = useCoachAssist()
  const navigate = useNavigate()

  if (ownerLoading) {
    return <div className="p-6 text-on-surface-variant">Loading…</div>
  }

  if (!isOwner) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant">
          <h1 className="font-headline-md text-on-surface mb-2">Not authorized</h1>
          <p className="text-on-surface-variant">
            You do not have owner access to this tool.
          </p>
        </div>
      </div>
    )
  }

  const enterCoach = (userId: string) => {
    selectCoach(userId)
    navigate('/sessions')
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-headline-md text-on-surface">Coach Assist</h1>
        <p className="text-on-surface-variant">
          Select a coach to manage their swimmers, sessions, and drills through the
          app's normal tabs. Edits are written to the coach's account only.
        </p>
      </header>

      {coach && (
        <section className="bg-secondary-container/30 rounded-2xl p-4 border border-outline-variant flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="supervisor_account" />
            <span className="font-body-md text-on-surface truncate">
              Assisting {coach.name}
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/sessions')}
              className="h-10 px-4 rounded-lg font-label-sm bg-primary text-on-primary cursor-pointer"
            >
              Open tabs
            </button>
            <button
              type="button"
              onClick={exit}
              className="h-10 px-4 rounded-lg font-label-sm border border-outline text-on-surface cursor-pointer"
            >
              Exit
            </button>
          </div>
        </section>
      )}

      <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant">
        <label
          className="block font-label-caps text-on-surface-variant mb-1"
          htmlFor="coach-select"
        >
          Select coach
        </label>
        <select
          id="coach-select"
          className="w-full md:w-80 min-h-12 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none"
          value=""
          onChange={(e) => {
            if (e.target.value) enterCoach(e.target.value)
          }}
        >
          <option value="">Select coach</option>
          {coaches.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.name}
            </option>
          ))}
        </select>
        {coaches.length === 0 && (
          <p className="text-label-sm text-on-surface-variant mt-1">No coaches available.</p>
        )}
      </section>
    </div>
  )
}
