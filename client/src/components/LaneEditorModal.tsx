import { useEffect, useState } from 'react'
import { listSwimmers, createSwimmerIfNotExists } from '../api/swimmers'
import { type Swimmer } from '../api/runs'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'
import { SwimmerFormModal, type SwimmerFormData } from './SwimmerFormModal'
import type { TimedGroup } from '../context/LiveSessionContext'

interface LaneEditorModalProps {
  state: { groups: TimedGroup[]; runId?: string | null }
  editorScrollToLane: number | null
  onScrollHandled: () => void
  onAddSwimmerToLane: (sw: Swimmer, gid: string) => void
  onAddGroup: (lane: number, name: string, id?: string) => void
  onRemoveGroup: (groupId: string) => void
  onMoveSwimmer: (swimmerId: number, fromGroupId: string, toGroupId: string) => void
  onUpdateGroupName: (groupId: string, name: string) => void
  onResetGroup: (groupId: string) => void
  onRemoveSwimmerFromLane: (swimmerId: number, groupId: string) => void
  onSaveTempSwimmer?: (swimmerId: number, groupId: string, data: SwimmerFormData) => Promise<void>
  onReorderSwimmers?: (groupId: string, swimmerIds: number[]) => void
  onAddTempSwimmer?: (groupId: string) => void
  onClose: () => void
}

export function LaneEditorModal({
  state, editorScrollToLane, onScrollHandled,
  onAddSwimmerToLane, onAddGroup, onRemoveGroup, onMoveSwimmer, onUpdateGroupName, onResetGroup,
  onRemoveSwimmerFromLane, onSaveTempSwimmer, onReorderSwimmers, onAddTempSwimmer, onClose,
}: LaneEditorModalProps) {
  const [allSwimmers, setAllSwimmers] = useState<Swimmer[]>([])
  const [unassignedSearch, setUnassignedSearch] = useState('')
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null)
  const [editingNameGroupId, setEditingNameGroupId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [resettingGroupId, setResettingGroupId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [savingSwimmer, setSavingSwimmer] = useState<{ id: number; name: string; groupId: string } | null>(null)

  useEffect(() => { listSwimmers().then(setAllSwimmers) }, [])

  const assignedIds = new Set(state.groups.flatMap(g => g.swimmers.map(s => s.dbId)))
  const unassignedPool = allSwimmers.filter(s => !assignedIds.has(s.id))
  const unassignedFiltered = unassignedSearch
    ? unassignedPool.filter(s => s.name.toLowerCase().includes(unassignedSearch.toLowerCase()))
    : unassignedPool
  const showAll = unassignedSearch.length > 0
  const visibleUnassigned = showAll ? unassignedFiltered : unassignedFiltered.slice(0, 4)

  const sortedGroups = [...state.groups].sort((a, b) => a.lane - b.lane)
  const laneOptions = [...new Set(state.groups.map(g => g.lane))].sort((a, b) => a - b)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-surface-container-lowest w-full max-w-2xl max-h-[85vh] md:max-h-[80vh] rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="font-headline-md text-on-surface">Manage Lane Swimmers</h3>
          <button onClick={onClose}
            className="h-10 w-10 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-surface-container transition-colors cursor-pointer">
            <Icon name="close" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-3" ref={el => {
          if (el && editorScrollToLane !== null) {
            const target = el.querySelector(`[data-lane="${editorScrollToLane}"]`)
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            onScrollHandled()
          }
        }}>
          {/* Quick Add Temp Swimmer */}
          {onAddTempSwimmer && sortedGroups.length > 0 && (
            <div className="bg-tertiary-container/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="bolt" size="sm" color="on-surface-variant" />
                <span className="text-label-sm font-bold text-on-surface">Quick Add Temp Swimmer</span>
              </div>
              <p className="text-xs text-on-surface-variant mb-3">Add a temp swimmer to start timing right away. You can save them to your roster later.</p>
              <div className="flex flex-wrap gap-2">
                {sortedGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => onAddTempSwimmer(group.id)}
                    className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-tertiary-container text-on-tertiary-container hover:brightness-95 transition-all cursor-pointer text-label-sm font-medium"
                  >
                    <Icon name="add" size="sm" />
                    Lane {group.lane}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Unassigned Section */}
          <div className="bg-surface-container-low rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-surface-variant text-on-surface-variant text-xs font-bold px-2 py-0.5 rounded-md">Unassigned</span>
              <span className="text-xs text-on-surface-variant ml-auto">{unassignedPool.length} swimmer{unassignedPool.length !== 1 ? 's' : ''}</span>
            </div>
            <input
              type="text"
              value={unassignedSearch}
              onChange={e => setUnassignedSearch(e.target.value)}
              placeholder="Filter swimmers..."
              className="w-full mb-2 bg-surface-container-lowest border-b border-outline focus:border-primary focus:ring-0 p-1.5 text-sm outline-none rounded"
            />
            {visibleUnassigned.map(sw => (
              <div key={sw.id} className="flex items-center gap-3 bg-surface-container-lowest rounded-lg px-3 py-2 mb-1.5 last:mb-0">
                <div className="w-7 h-7 rounded-full bg-primary-container/40 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                  {sw.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-on-surface flex-1 min-w-0 truncate">{sw.name}</span>
                <div className="flex items-center gap-1">
                  {laneOptions.map(laneNum => (
                    <button key={laneNum}
                      onClick={() => {
                        const target = state.groups.find(g => g.lane === laneNum)
                        if (target) onAddSwimmerToLane(sw, target.id)
                      }}
                      className="px-2 py-1 rounded-md text-xs font-bold bg-surface-container text-on-surface-variant hover:bg-surface-container-higher transition-colors cursor-pointer">
                      {laneNum}
                    </button>
                  ))}
                  <button onClick={() => {
                    const max = state.groups.reduce((m, g) => Math.max(m, g.lane), 0)
                    const newId = crypto.randomUUID()
                    onAddGroup(max + 1, `Lane ${max + 1}`, newId)
                    onAddSwimmerToLane(sw, newId)
                  }}
                    className="px-2 py-1 rounded-md text-xs font-bold bg-surface-container text-on-surface-variant hover:bg-surface-container-higher transition-colors cursor-pointer">
                    +L
                  </button>
                </div>
              </div>
            ))}
            {!showAll && unassignedFiltered.length > 4 && (
              <p className="text-xs text-on-surface-variant text-center py-2 italic">... and {unassignedFiltered.length - 4} more</p>
            )}
            {unassignedSearch && visibleUnassigned.length === 0 && (
              <p className="text-xs text-on-surface-variant text-center py-3">No swimmers match</p>
            )}
            {!unassignedSearch && unassignedPool.length === 0 && (
              <p className="text-xs text-on-surface-variant text-center py-3 italic">All swimmers are assigned</p>
            )}
            <div className="mt-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full py-2 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer"
              >
                <Icon name="person_add" size="md" />
                Create new swimmer
              </button>
            </div>
          </div>

          {/* Lane Sections */}
          {sortedGroups.map(group => (
            <div key={group.id} data-lane={group.lane} className="bg-surface-container-low rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-primary-container text-on-primary-container text-xs font-bold px-2 py-0.5 rounded-md">Lane {group.lane}</span>
                {editingNameGroupId === group.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    className="flex-1 bg-surface-container-lowest border-b-2 border-primary p-0.5 text-sm font-bold outline-none rounded-t min-w-0"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Escape') setEditingNameGroupId(null)
                      if (e.key === 'Enter') {
                        onUpdateGroupName(group.id, editingName)
                        setEditingNameGroupId(null)
                      }
                    }}
                  />
                ) : (
                  <span className="font-bold text-sm text-on-surface min-w-0 truncate">{group.name}</span>
                )}
                <button onClick={() => {
                  if (editingNameGroupId === group.id) {
                    onUpdateGroupName(group.id, editingName)
                    setEditingNameGroupId(null)
                  } else {
                    setEditingName(group.name)
                    setEditingNameGroupId(group.id)
                  }
                }}
                  className="h-5 w-5 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all cursor-pointer shrink-0">
                  <Icon name="edit" size="xs" />
                </button>
                <span className="text-xs text-on-surface-variant">{group.swimmers.length} swimmer{group.swimmers.length !== 1 ? 's' : ''}</span>
                {onAddTempSwimmer && (
                  <button
                    onClick={() => onAddTempSwimmer(group.id)}
                    className="h-6 px-2 rounded-full bg-tertiary-container/50 text-tertiary text-label-sm font-medium flex items-center gap-1 hover:bg-tertiary-container transition-all cursor-pointer"
                    title="Add temp swimmer"
                  >
                    <Icon name="add" size="xs" />
                    Temp
                  </button>
                )}
                {group.swimmers.length === 0 && (
                  <button onClick={() => setRemovingGroupId(group.id)}
                    className="ml-auto text-xs text-error font-semibold hover:underline cursor-pointer">Remove</button>
                )}
              </div>
              {group.swimmers.length === 0 ? (
                <p className="text-xs text-on-surface-variant text-center py-3 italic">No swimmers assigned</p>
              ) : group.swimmers.map((sw, idx) => {
                const isTemp = sw.dbId?.startsWith('quick-')
                return (
                  <div key={sw.id} className="flex items-center gap-3 bg-surface-container-lowest rounded-lg px-3 py-2 mb-1.5 last:mb-0">
                    {onReorderSwimmers && (
                      <div className="flex flex-col gap-px shrink-0">
                        <button
                          onClick={() => {
                            if (idx === 0) return
                            const newIds = group.swimmers.map(s => s.id)
                            ;[newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]]
                            onReorderSwimmers(group.id, newIds)
                          }}
                          disabled={idx === 0}
                          className="h-5 w-5 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Icon name="keyboard_arrow_up" size="xs" />
                        </button>
                        <button
                          onClick={() => {
                            if (idx === group.swimmers.length - 1) return
                            const newIds = group.swimmers.map(s => s.id)
                            ;[newIds[idx], newIds[idx + 1]] = [newIds[idx + 1], newIds[idx]]
                            onReorderSwimmers(group.id, newIds)
                          }}
                          disabled={idx === group.swimmers.length - 1}
                          className="h-5 w-5 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-primary-container/60 transition-all disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Icon name="keyboard_arrow_down" size="xs" />
                        </button>
                      </div>
                    )}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isTemp ? 'bg-tertiary-container/30 text-tertiary' : 'bg-primary-container/40 text-primary'}`}>
                      {isTemp ? (
                        <Icon name="bolt" size="xs" />
                      ) : (
                        <span className="font-bold text-xs">{sw.name.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-on-surface truncate block">{sw.name}</span>
                      {isTemp && (
                        <span className="text-label-sm text-tertiary">Temp swimmer</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isTemp && onSaveTempSwimmer && (
                        <button
                          onClick={() => setSavingSwimmer({ id: sw.id, name: sw.name, groupId: group.id })}
                          className="h-7 px-2 rounded-full bg-primary text-on-primary text-label-sm font-bold hover:brightness-110 transition-all cursor-pointer"
                          title="Save to roster"
                        >
                          Save
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveSwimmerFromLane(sw.id, group.id)}
                        className="h-7 w-7 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-error-container hover:text-on-error-container transition-all cursor-pointer"
                        title="Remove from lane"
                      >
                        <Icon name="close" size="xs" />
                      </button>
                      {laneOptions.map(laneNum => (
                        <button key={laneNum}
                          onClick={() => {
                            if (laneNum === group.lane) return
                            onMoveSwimmer(sw.id, group.id, state.groups.find(g => g.lane === laneNum)?.id ?? '')
                          }}
                          className={`px-2 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                            laneNum === group.lane
                              ? 'bg-primary-container text-on-primary-container'
                              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-higher'
                          }`}>
                          {laneNum}
                        </button>
                      ))}
                      <button onClick={() => {
                        const max = state.groups.reduce((m, g) => Math.max(m, g.lane), 0)
                        const newId = crypto.randomUUID()
                        onAddGroup(max + 1, `Lane ${max + 1}`, newId)
                        onMoveSwimmer(sw.id, group.id, newId)
                      }}
                        className="px-2 py-1 rounded-md text-xs font-bold bg-surface-container text-on-surface-variant hover:bg-surface-container-higher transition-colors cursor-pointer">
                        +L
                      </button>
                    </div>
                  </div>
                )
              })}
              {group.swimmers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-outline-variant/30">
                  <button onClick={() => setResettingGroupId(group.id)}
                    className="text-xs text-error font-semibold flex items-center gap-1 hover:underline cursor-pointer">
                    <Icon name="refresh" size="xs" />
                    Reset lane
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {removingGroupId && (
          <ConfirmDialog
            open={true}
            title="Remove lane?"
            message={`Remove this lane? Swimmers must be moved first. This cannot be undone.`}
            confirmLabel="Remove"
            cancelLabel="Cancel"
            destructive={true}
            onConfirm={() => { onRemoveGroup(removingGroupId); setRemovingGroupId(null) }}
            onCancel={() => setRemovingGroupId(null)}
          />
        )}
        {resettingGroupId && (
          <ConfirmDialog
            open={true}
            title="Reset lane?"
            message={`Clear all timing data for this lane and return to the first drill? Swimmers will remain assigned.`}
            confirmLabel="Reset"
            cancelLabel="Cancel"
            destructive={true}
            onConfirm={() => { onResetGroup(resettingGroupId); setResettingGroupId(null) }}
            onCancel={() => setResettingGroupId(null)}
          />
        )}
        <SwimmerFormModal
          key={showCreateModal ? 'create-open' : 'create-closed'}
          open={showCreateModal}
          editingId={null}
          onSave={async (data) => {
            await createSwimmerIfNotExists({ name: data.name, group: data.group, notes: data.notes, status: data.status as 'active' | 'inactive' })
            const updated = await listSwimmers()
            setAllSwimmers(updated)
            setShowCreateModal(false)
          }}
          onClose={() => setShowCreateModal(false)}
          rosterSwimmers={allSwimmers.map(s => ({ id: s.id, name: s.name, group: s.group, notes: s.notes, status: s.status }))}
        />
        <SwimmerFormModal
          key={savingSwimmer ? `save-${savingSwimmer.id}` : 'save-closed'}
          open={savingSwimmer !== null}
          editingId={null}
          initialData={savingSwimmer ? { name: savingSwimmer.name, group: '', notes: '', status: 'active' } : undefined}
          onSave={async (data) => {
            if (savingSwimmer && onSaveTempSwimmer) {
              await onSaveTempSwimmer(savingSwimmer.id, savingSwimmer.groupId, data)
              setSavingSwimmer(null)
            }
          }}
          onClose={() => setSavingSwimmer(null)}
          rosterSwimmers={allSwimmers.map(s => ({ id: s.id, name: s.name, group: s.group, notes: s.notes, status: s.status }))}
        />
        <div className="flex gap-2 mt-4 shrink-0">
          <button onClick={() => {
            const max = state.groups.reduce((m, g) => Math.max(m, g.lane), 0)
            onAddGroup(max + 1, `Lane ${max + 1}`)
          }}
            className="flex-1 min-h-11 py-3 rounded-xl border-2 border-dashed border-outline-variant flex items-center justify-center gap-2 text-sm text-on-surface-variant hover:text-primary hover:border-primary transition-colors cursor-pointer">
            <Icon name="add" size="md" />
            Add Lane
          </button>
          <button onClick={onClose}
            className="flex-1 min-h-11 py-3 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:brightness-95 transition-colors cursor-pointer">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
