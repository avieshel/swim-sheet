import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSwimmer, updateSwimmer, deleteSwimmer, deleteSwimmerWithData, exportSwimmerData } from '../api/swimmers'
import type { Swimmer } from '../api/runs'
import { SwimmerFormModal } from '../components/SwimmerFormModal'
import { RunHistoryTable } from '../components/Table'
import { downloadBlob } from '../utils/downloadBlob'
import { Icon } from '../components/Icon'

export const SwimmerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [swimmer, setSwimmer] = useState<Swimmer | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (showDeleteConfirm || showEditModal) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [showDeleteConfirm, showEditModal])

  useEffect(() => {
    const load = async () => {
      if (!id) return
      const s = await getSwimmer(id)
      if (!s) { setLoading(false); return }
      setSwimmer(s)
      setEditName(s.name)
      setEditGroup(s.group || '')
      setEditNotes(s.notes || '')
      setEditStatus(s.status || 'active')
      setLoading(false)
    }
    load()
  }, [id])

  const openEditModal = () => {
    if (!swimmer) return
    setEditName(swimmer.name)
    setEditGroup(swimmer.group || '')
    setEditNotes(swimmer.notes || '')
    setEditStatus(swimmer.status || 'active')
    setShowEditModal(true)
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    await deleteSwimmer(id)
    setShowDeleteConfirm(false)
    navigate('/swimmers')
  }

  const handleDeleteWithExport = async () => {
    if (!id) return
    setDeleting(true)
    try {
      const blob = await deleteSwimmerWithData(id)
      if (blob) {
        downloadBlob(blob, `swimmer-${id}-data.json`)
      }
    } catch {
      await deleteSwimmer(id)
    }
    setShowDeleteConfirm(false)
    navigate('/swimmers')
  }

  const handleExportOnly = async () => {
    if (!id) return
    const blob = await exportSwimmerData(id)
    downloadBlob(blob, `swimmer-${id}-data.json`)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">Loading...</p>
    </div>
  )
  if (!swimmer) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">Swimmer not found.</p>
    </div>
  )

  return (
    <div>
      <button
        onClick={() => navigate('/swimmers')}
        className="h-11 px-3 mb-4 inline-flex items-center gap-1.5 rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all cursor-pointer border-none"
      >
        <Icon name="arrow_back" size="sm" />
        <span className="text-label-sm font-medium">Back to Swimmers</span>
      </button>

      {/* Profile Header */}
      <div className="bg-surface-container-lowest rounded-xl p-5 md:p-6 border border-outline-variant mb-6">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-surface-variant flex-shrink-0 bg-primary-container flex items-center justify-center">
              <Icon name="person" size="2xl" color="on-surface-variant" />
            </div>
            <div>
              <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface m-0">{swimmer.name}</h1>
              {swimmer.group && (
                <span className="inline-block mt-2 bg-secondary-container/30 text-on-secondary-container px-3 py-1 rounded text-label-sm font-bold">
                  {swimmer.group}
                </span>
              )}
              <span className={`inline-block mt-2 ml-2 px-3 py-1 rounded text-label-sm font-bold ${
                swimmer.status === 'inactive'
                  ? 'bg-surface-variant text-on-surface-variant'
                  : 'bg-green-100 text-green-700'
              }`}>
                {swimmer.status === 'inactive' ? 'Inactive' : 'Active'}
              </span>
              {swimmer.notes && (
                <p className="font-body-md text-body-md text-on-surface-variant mt-2">{swimmer.notes}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openEditModal}
              className="h-touch-target-min px-4 bg-primary text-on-primary rounded-lg font-label-sm flex items-center gap-2 hover:brightness-110 active:scale-95 transition-colors cursor-pointer"
            >
              <Icon name="edit" size="lg" />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="h-touch-target-min px-4 border-2 border-error/30 text-error rounded-lg font-label-sm flex items-center gap-2 hover:bg-error-container transition-colors cursor-pointer"
            >
              <Icon name="delete" size="lg" />
            </button>
          </div>
        </div>
      </div>

      {/* General Info Section */}
      {swimmer.notes && (
        <div className="bg-surface-container-lowest rounded-xl p-5 md:p-6 border border-outline-variant mb-6">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-3 flex items-center gap-2">
            <Icon name="info" color="primary" />
            General Information
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-wrap">{swimmer.notes}</p>
        </div>
      )}

      {/* Sessions */}
      <div className="bg-surface-container-lowest rounded-xl p-5 md:p-6 border border-outline-variant">
        <h3 className="font-headline-md text-headline-md text-on-surface mb-4 flex items-center gap-2">
          <Icon name="event_note" color="primary" />
          Session History
        </h3>
        <RunHistoryTable swimmerId={id} borderless focusName={swimmer.name} lastAttended />
      </div>

      <SwimmerFormModal
        key={showEditModal ? id ?? 'edit' : 'closed'}
        open={showEditModal}
        editingId={id ?? null}
        initialData={{ name: editName, group: editGroup, notes: editNotes, status: editStatus }}
        onSave={async (data) => {
          if (!id) return
          await updateSwimmer(id, data)
          setSwimmer({ ...swimmer, ...data })
          setShowEditModal(false)
        }}
        onClose={() => setShowEditModal(false)}
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-8 max-w-md w-full border border-outline-variant shadow-2xl">
            <h3 className="font-headline-md text-headline-md font-bold text-primary mb-4">Delete {swimmer.name}?</h3>
            <p className="text-on-surface-variant font-body-md mb-6">
              Choose what to do with this swimmer's data:
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteWithExport}
                disabled={deleting}
                className="w-full bg-primary text-on-primary font-bold px-6 py-3.5 rounded-xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 cursor-pointer border-none"
              >
                {deleting ? 'Deleting...' : 'Export data & delete'}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full bg-error text-on-error font-bold px-6 py-3.5 rounded-xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 cursor-pointer border-none"
              >
                Delete all data permanently
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="w-full bg-surface-variant text-on-surface-variant font-bold px-6 py-3.5 rounded-xl hover:bg-surface transition-all active:scale-95 cursor-pointer border-none"
              >
                Cancel
              </button>
              <div className="mt-2 pt-3 border-t border-outline-variant/30">
                <button
                  onClick={handleExportOnly}
                  className="w-full text-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer bg-transparent border-none underline"
                >
                  Export data without deleting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
