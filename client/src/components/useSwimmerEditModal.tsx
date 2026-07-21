import { useState } from 'react'
import { SwimmerFormModal, type SwimmerFormData } from './SwimmerFormModal'
import { getSwimmer, createSwimmer, updateSwimmer, searchSwimmers } from '../api/swimmers'
import { promoteAndLinkSwimmer, addSwimmerToRun, removeSwimmerFromRun } from '../api/runs'

export type RosterSwimmer = { id: string; name: string; group: string; notes: string; status: string }

export interface SwimmerAllocation {
  groupId: string
  groupName: string
}

interface UseSwimmerEditModalOptions {
  runId: string | null
  lane: number
  isVirtual: boolean
  getName: () => string
  getDbId: () => string | undefined
  currentGroupId: string
  findExistingAllocation?: (dbId: string) => SwimmerAllocation | null
  rosterSwimmers?: RosterSwimmer[]
  onSwimmerSaved?: () => void
  onApply: (targetDbId: string, data: SwimmerFormData) => void | Promise<void>
}

// Single source of truth for the "click a swimmer's name -> create/edit" flow.
// Shared by ActiveSwimmerRow and SavedSwimmerRow so the promotion / re-link /
// duplicate-avoidance logic lives in exactly one place.
//
// A swimmer allocated to a lane cannot be moved to another lane. If a coach tries
// to point a swimmer (virtual or real) at a roster swimmer already allocated in a
// different lane, the action is blocked with a message. To fix a mistaken
// allocation, delete the swimmer from their current lane, then re-add them in the
// desired lane.
export function useSwimmerEditModal(opts: UseSwimmerEditModalOptions) {
  const [showSwimmerModal, setShowSwimmerModal] = useState(false)
  const [editSwimmerId, setEditSwimmerId] = useState<string | null>(null)
  const [swimmerModalKey, setSwimmerModalKey] = useState(0)
  const [swimmerFormData, setSwimmerFormData] = useState<SwimmerFormData>({ name: '', group: '', notes: '', status: 'active' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameClick = async () => {
    setError(null)
    if (opts.isVirtual) {
      setEditSwimmerId(null)
      setSwimmerFormData({ name: opts.getName(), group: '', notes: '', status: 'active' })
      setSwimmerModalKey(k => k + 1)
      setShowSwimmerModal(true)
    } else {
      const dbId = opts.getDbId()
      if (!dbId) return
      try {
        const s = await getSwimmer(dbId)
        if (s) {
          setEditSwimmerId(dbId)
          setSwimmerFormData({ name: s.name, group: s.group, notes: s.notes, status: s.status as 'active' | 'inactive' })
          setSwimmerModalKey(k => k + 1)
          setShowSwimmerModal(true)
        }
      } catch {
        // Swimmer not found
      }
    }
  }

  const finalizeSave = async (ctx: { data: SwimmerFormData; realDbId: string; selectedId?: string; currentDbId: string; editSwimmerId: string | null }) => {
    setSaving(true)
    try {
      // Re-point the live allocation first so the UI reflects the change immediately
      // and independently of any persistence failure.
      await opts.onApply(ctx.realDbId, ctx.data)
      if (opts.runId) {
        try {
          await promoteAndLinkSwimmer(opts.runId, ctx.currentDbId, ctx.data.name, ctx.realDbId, ctx.data.group)
          // Ensure a run link exists at the current lane (replaces any prior allocation).
          await addSwimmerToRun(opts.runId, ctx.realDbId, opts.lane)
          // Re-pointing an existing roster swimmer to a *different* existing one: swap the run link
          if (ctx.editSwimmerId && ctx.selectedId && ctx.selectedId !== ctx.editSwimmerId) {
            await removeSwimmerFromRun(opts.runId, ctx.editSwimmerId)
          }
        } catch {
          // Persistence is best-effort; the live allocation is already correct.
        }
      }
      opts.onSwimmerSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const handleModalSave = async (data: SwimmerFormData) => {
    setError(null)
    const selectedId = data.selectedDbId
    const currentDbId = opts.getDbId()

    // Pure edit of an existing roster swimmer (no re-link requested)
    if (editSwimmerId && (!selectedId || selectedId === editSwimmerId)) {
      await updateSwimmer(editSwimmerId, { name: data.name, group: data.group, notes: data.notes, status: data.status })
      await opts.onApply(editSwimmerId, data)
      opts.onSwimmerSaved?.()
      setShowSwimmerModal(false)
      return
    }

    if (!opts.runId || !currentDbId) return

    // Resolve the real swimmer id up front (no persistence side effects yet)
    let realDbId: string
    if (selectedId) {
      realDbId = selectedId
    } else {
      const existing = await searchSwimmers(data.name)
      realDbId = existing.length > 0 ? existing[0].id : await createSwimmer({ name: data.name, group: data.group, notes: data.notes, status: data.status })
    }

    // A swimmer can only be allocated to one lane per run. Block pointing this
    // lane's swimmer at a roster swimmer already allocated in a different lane.
    const allocation = opts.findExistingAllocation?.(realDbId)
    if (allocation && allocation.groupId !== opts.currentGroupId) {
      setError(`"${data.name}" is already in ${allocation.groupName}. Delete them from that lane first, then re-add here.`)
      return
    }

    await finalizeSave({ data, realDbId, selectedId, currentDbId, editSwimmerId })
    setShowSwimmerModal(false)
  }

  const modal = (
    <SwimmerFormModal
      key={swimmerModalKey}
      open={showSwimmerModal}
      editingId={editSwimmerId}
      initialData={swimmerFormData}
      onSave={handleModalSave}
      onClose={() => setShowSwimmerModal(false)}
      rosterSwimmers={opts.rosterSwimmers}
      error={error}
    />
  )

  return { showSwimmerModal, saving, handleNameClick, handleModalSave, modal }
}
