import { useEffect, useMemo, useState } from 'react'
import { useAdminStatus } from '../services/admin/useAdminStatus'
import {
  listCoaches,
  getCoachData,
  adminCreate,
  adminUpdate,
  adminDelete,
  adminMaterializeDraft,
  type CoachSummary,
  type CoachData,
  type ScopedTable,
} from '../services/admin/adminCoachService'
import {
  toSwimmerRow,
  toDrillRow,
  toSessionPatch,
  type DrillFormData as MappingDrillFormData,
} from '../services/admin/coachDataMapping'
import { SwimmerFormModal } from '../components/SwimmerFormModal'
import type { SwimmerFormData as ModalSwimmerFormData } from '../components/SwimmerFormModal'
import { DrillEditorModal } from '../components/DrillEditorModal'
import type { DrillFormData as ModalDrillFormData } from '../components/DrillEditorModal'
import { SessionMetadataModal } from '../components/session/SessionMetadataModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DraftSessionPanel } from '../components/ai/DraftSessionPanel'
import { getDrillTotalDistance } from '../utils/drillHelpers'
import type { Stroke } from '../types/swimming'
import type { SessionDraftV1 } from '../../../shared/sessionDraft/types'

const EMPTY_DRAFT: SessionDraftV1 = {
  schemaVersion: 1,
  session: { name: '' },
  drills: [],
}

type DataKey = 'sessions' | 'drills' | 'swimmers'

const COACH_DATA_TABS: { key: DataKey; label: string }[] = [
  { key: 'sessions', label: 'Sessions' },
  { key: 'drills', label: 'Drills' },
  { key: 'swimmers', label: 'Swimmers' },
]

interface DisplayRow {
  id: string
  name: string
  sessionId?: string
}

function toDisplayRows(items: unknown[], nameKey = 'name'): DisplayRow[] {
  return (items as Array<Record<string, unknown>>).map((it) => ({
    id: String(it.id ?? ''),
    name: String(it[nameKey] ?? '(unnamed)'),
    sessionId: it.session_id !== undefined ? String(it.session_id) : undefined,
  }))
}

// The drill editor emits a rich client form (items/repeatCount/labels/...). The
// cloud row only needs the scalar identity fields, so we derive them here.
function drillFormFromModal(form: ModalDrillFormData): MappingDrillFormData {
  const firstItem = form.items?.[0]
  return {
    name: form.name,
    stroke: (form.stroke ?? firstItem?.stroke ?? 'freestyle') as Stroke,
    distance: form.distance ?? getDrillTotalDistance(form),
    order: form.order ?? 0,
  }
}

export function AdminCoachAssist() {
  const { isOwner, loading } = useAdminStatus()
  const [coaches, setCoaches] = useState<CoachSummary[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState('')
  const [coachData, setCoachData] = useState<CoachData | null>(null)

  const [swimmerModal, setSwimmerModal] = useState<{ open: boolean; editing: DisplayRow | null }>({
    open: false,
    editing: null,
  })
  const [drillModal, setDrillModal] = useState<{ open: boolean; editing: DisplayRow | null; sessionId: string }>({
    open: false,
    editing: null,
    sessionId: '',
  })
  const [sessionModal, setSessionModal] = useState<{ open: boolean; editing: DisplayRow | null }>({
    open: false,
    editing: null,
  })
  const [confirmDelete, setConfirmDelete] = useState<{ table: ScopedTable; id: string; name: string } | null>(null)
  const [draft, setDraft] = useState<SessionDraftV1>(EMPTY_DRAFT)
  const [draftSaving, setDraftSaving] = useState(false)
  const [tab, setTab] = useState<DataKey>('sessions')

  useEffect(() => {
    if (isOwner && coaches.length === 0) {
      void listCoaches()
        .then(setCoaches)
        .catch(() => setCoaches([]))
    }
  }, [isOwner, coaches.length])

  useEffect(() => {
    if (!selectedCoachId) {
      return
    }
    let cancelled = false
    void getCoachData(selectedCoachId)
      .then((data) => {
        if (!cancelled) setCoachData(data)
      })
      .catch(() => {
        if (!cancelled) {
          setCoachData({ sessions: [], drills: [], swimmers: [], libraryDrills: [] })
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedCoachId])

  const selectedCoach = useMemo(
    () => coaches.find((c) => c.userId === selectedCoachId) ?? null,
    [coaches, selectedCoachId],
  )
  const orgId = selectedCoach?.orgId ?? ''
  const controlsDisabled = !selectedCoachId

  if (loading) {
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

  const refresh = () => {
    if (!selectedCoachId) return
    void getCoachData(selectedCoachId)
      .then(setCoachData)
      .catch(() => {})
  }

  const getItem = (table: DataKey, id: string): Record<string, unknown> | undefined => {
    const arr = (coachData?.[table] as unknown[]) ?? []
    return (arr as Array<Record<string, unknown>>).find((it) => String(it.id) === id)
  }

  const handleSwimmerSave = (form: ModalSwimmerFormData) => {
    if (!selectedCoachId) return
    const mapped = toSwimmerRow(form, orgId, selectedCoachId)
    const task = swimmerModal.editing
      ? adminUpdate(selectedCoachId, 'swimmers', swimmerModal.editing.id, mapped)
      : adminCreate(selectedCoachId, 'swimmers', mapped)
    void task
      .then(() => {
        setSwimmerModal({ open: false, editing: null })
        refresh()
      })
      .catch(() => {})
  }

  const handleDrillSave = (form: ModalDrillFormData) => {
    if (!selectedCoachId) return
    const mapped = toDrillRow(drillFormFromModal(form), drillModal.sessionId, orgId, selectedCoachId)
    const task = drillModal.editing
      ? adminUpdate(selectedCoachId, 'drills', drillModal.editing.id, mapped)
      : adminCreate(selectedCoachId, 'drills', mapped)
    void task
      .then(() => {
        setDrillModal({ open: false, editing: null, sessionId: '' })
        refresh()
      })
      .catch(() => {})
  }

  const handleSessionSave = (meta: { name: string; notes: string }) => {
    if (!selectedCoachId) return
    const forCreate = !sessionModal.editing
    const mapped = toSessionPatch(meta, orgId, selectedCoachId, forCreate)
    const task = sessionModal.editing
      ? adminUpdate(selectedCoachId, 'sessions', sessionModal.editing.id, mapped)
      : adminCreate(selectedCoachId, 'sessions', mapped)
    void task
      .then(() => {
        setSessionModal({ open: false, editing: null })
        refresh()
      })
      .catch(() => {})
  }

  const handleDelete = () => {
    if (!confirmDelete || !selectedCoachId) return
    const target = confirmDelete
    void adminDelete(selectedCoachId, target.table, target.id)
      .then(() => {
        setConfirmDelete(null)
        refresh()
      })
      .catch(() => setConfirmDelete(null))
  }

  const handleMaterialize = () => {
    if (!selectedCoachId) return
    setDraftSaving(true)
    void adminMaterializeDraft(selectedCoachId, draft)
      .then(() => {
        setDraftSaving(false)
        setDraft(EMPTY_DRAFT)
        refresh()
      })
      .catch(() => setDraftSaving(false))
  }

  const sessions = toDisplayRows(coachData?.sessions ?? [])
  const swimmers = toDisplayRows(coachData?.swimmers ?? [])
  const allDrills = toDisplayRows(coachData?.drills ?? [])

  const drillsForSession = (sessionId: string) =>
    allDrills.filter((d) => d.sessionId === sessionId)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="font-headline-md text-on-surface">Coach Assist</h1>
        <p className="text-on-surface-variant">
          Owner tool to manage a coach's sessions, drills, and swimmers.
        </p>
      </header>

      <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant">
        <label className="block font-label-caps text-on-surface-variant mb-1" htmlFor="coach-select">
          Select coach
        </label>
        <select
          id="coach-select"
          className="w-full md:w-80 min-h-12 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none"
          value={selectedCoachId}
          onChange={(e) => setSelectedCoachId(e.target.value)}
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

      {selectedCoachId && (
        <>
          <div
            role="tablist"
            aria-label="Coach data sections"
            className="flex gap-1 border-b border-outline-variant"
          >
            {COACH_DATA_TABS.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={
                    'px-4 py-2 -mb-px border-b-2 font-label-sm cursor-pointer ' +
                    (active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface')
                  }
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {tab === 'sessions' && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-on-surface">Sessions</h2>
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={() => setSessionModal({ open: true, editing: null })}
                className="h-10 px-4 rounded-lg font-label-sm bg-primary text-on-primary disabled:opacity-40 cursor-pointer"
              >
                Add session
              </button>
            </div>
            {sessions.length === 0 && (
              <p className="text-label-sm text-on-surface-variant">No sessions.</p>
            )}
            {sessions.map((session) => (
              <div key={session.id} className="rounded-xl bg-surface-container-low p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-body-md text-on-surface">{session.name}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => setSessionModal({ open: true, editing: session })}
                      className="h-9 px-3 rounded-lg font-label-sm border border-outline text-on-surface disabled:opacity-40 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => setConfirmDelete({ table: 'sessions', id: session.id, name: session.name })}
                      className="h-9 px-3 rounded-lg font-label-sm bg-error text-on-error disabled:opacity-40 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-label-sm text-on-surface-variant">Drills</span>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setDrillModal({ open: true, editing: null, sessionId: session.id })}
                    className="h-9 px-3 rounded-lg font-label-sm bg-primary text-on-primary disabled:opacity-40 cursor-pointer"
                  >
                    Add drill
                  </button>
                </div>
                {drillsForSession(session.id).length === 0 && (
                  <p className="text-label-sm text-on-surface-variant mt-1">No drills.</p>
                )}
                {drillsForSession(session.id).map((drill) => (
                  <div key={drill.id} className="flex items-center justify-between gap-2 pl-3 mt-1">
                    <span className="font-body-md text-on-surface">{drill.name}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={controlsDisabled}
                        onClick={() => setDrillModal({ open: true, editing: drill, sessionId: session.id })}
                        className="h-9 px-3 rounded-lg font-label-sm border border-outline text-on-surface disabled:opacity-40 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={controlsDisabled}
                        onClick={() => setConfirmDelete({ table: 'drills', id: drill.id, name: drill.name })}
                        className="h-9 px-3 rounded-lg font-label-sm bg-error text-on-error disabled:opacity-40 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
          )}

          {tab === 'swimmers' && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-on-surface">Swimmers</h2>
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={() => setSwimmerModal({ open: true, editing: null })}
                className="h-10 px-4 rounded-lg font-label-sm bg-primary text-on-primary disabled:opacity-40 cursor-pointer"
              >
                Add swimmer
              </button>
            </div>
            {swimmers.length === 0 && (
              <p className="text-label-sm text-on-surface-variant">No swimmers.</p>
            )}
            {swimmers.map((swimmer) => (
              <div key={swimmer.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-container-low p-3">
                <span className="font-body-md text-on-surface">{swimmer.name}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setSwimmerModal({ open: true, editing: swimmer })}
                    className="h-9 px-3 rounded-lg font-label-sm border border-outline text-on-surface disabled:opacity-40 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setConfirmDelete({ table: 'swimmers', id: swimmer.id, name: swimmer.name })}
                    className="h-9 px-3 rounded-lg font-label-sm bg-error text-on-error disabled:opacity-40 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </section>
          )}

          {tab === 'drills' && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-on-surface">Drills</h2>
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={() => setDrillModal({ open: true, editing: null, sessionId: '' })}
                className="h-10 px-4 rounded-lg font-label-sm bg-primary text-on-primary disabled:opacity-40 cursor-pointer"
              >
                Add drill
              </button>
            </div>
            {allDrills.length === 0 && (
              <p className="text-label-sm text-on-surface-variant">No drills.</p>
            )}
            {allDrills.map((drill) => (
              <div key={drill.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-container-low p-3">
                <div className="min-w-0">
                  <span className="font-body-md text-on-surface">{drill.name}</span>
                  <p className="text-label-sm text-on-surface-variant truncate">
                    {drill.sessionId ? 'In a session' : 'Ungrouped'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setDrillModal({ open: true, editing: drill, sessionId: drill.sessionId ?? '' })}
                    className="h-9 px-3 rounded-lg font-label-sm border border-outline text-on-surface disabled:opacity-40 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setConfirmDelete({ table: 'drills', id: drill.id, name: drill.name })}
                    className="h-9 px-3 rounded-lg font-label-sm bg-error text-on-error disabled:opacity-40 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </section>
          )}

          {tab === 'sessions' && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant">
            <h2 className="font-headline-sm text-on-surface mb-3">Place AI draft</h2>
            <DraftSessionPanel
              draft={draft}
              onChange={setDraft}
              onSave={handleMaterialize}
              onDiscard={() => setDraft(EMPTY_DRAFT)}
              saving={draftSaving}
            />
          </section>
          )}
        </>
      )}

      <SwimmerFormModal
        open={swimmerModal.open}
        editingId={swimmerModal.editing?.id ?? null}
        initialData={
          swimmerModal.editing
            ? (() => {
                const rec = getItem('swimmers', swimmerModal.editing.id)
                return rec
                  ? {
                      name: String(rec.name ?? ''),
                      group: String(rec.group_name ?? ''),
                      notes: String(rec.notes ?? ''),
                      status: rec.status === 'inactive' ? 'inactive' : 'active',
                    }
                  : undefined
              })()
            : undefined
        }
        onSave={handleSwimmerSave}
        onClose={() => setSwimmerModal({ open: false, editing: null })}
      />

      <DrillEditorModal
        open={drillModal.open}
        title={drillModal.editing ? 'Edit Drill' : 'New Drill'}
        initialData={
          drillModal.editing
            ? (() => {
                const rec = getItem('drills', drillModal.editing.id)
                return rec
                  ? {
                      id: String(rec.id),
                      name: String(rec.name ?? ''),
                      stroke: (rec.stroke as Stroke) ?? 'freestyle',
                      distance: Number(rec.distance ?? 0),
                      order: Number(rec.drill_order ?? 0),
                      sessionId: drillModal.sessionId,
                    }
                  : undefined
              })()
            : { sessionId: drillModal.sessionId }
        }
        onSave={handleDrillSave}
        onClose={() => setDrillModal({ open: false, editing: null, sessionId: '' })}
      />

      {sessionModal.open && (
        <SessionMetadataModal
          initialData={
            sessionModal.editing
              ? (() => {
                  const rec = getItem('sessions', sessionModal.editing.id)
                  return rec
                    ? { name: String(rec.name ?? ''), notes: String(rec.notes ?? '') }
                    : { name: '', notes: '' }
                })()
              : { name: '', notes: '' }
          }
          onSave={handleSessionSave}
          onClose={() => setSessionModal({ open: false, editing: null })}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete row"
        message={
          confirmDelete
            ? `Delete "${confirmDelete.name}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

