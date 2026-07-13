import { useEffect, useState } from 'react'
import { listSwimmers } from '../api/swimmers'
import { type Swimmer } from '../api/runs'
import { ConfirmDialog } from './ConfirmDialog'
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
  onClose: () => void
}

export function LaneEditorModal({
  state, editorScrollToLane, onScrollHandled,
  onAddSwimmerToLane, onAddGroup, onRemoveGroup, onMoveSwimmer, onUpdateGroupName, onResetGroup, onClose,
}: LaneEditorModalProps) {
  const [allSwimmers, setAllSwimmers] = useState<Swimmer[]>([])
  const [unassignedSearch, setUnassignedSearch] = useState('')
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null)
  const [editingNameGroupId, setEditingNameGroupId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [resettingGroupId, setResettingGroupId] = useState<string | null>(null)

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

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-surface-container-lowest w-full max-w-2xl max-h-[85vh] md:max-h-[80vh] rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="font-headline-md text-on-surface">Manage Lane Swimmers</h3>
          <button onClick={onClose}
            className="h-10 w-10 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center hover:bg-surface-container transition-colors cursor-pointer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-3" ref={el => {
          if (el && editorScrollToLane !== null) {
            const target = el.querySelector(`[data-lane="${editorScrollToLane}"]`)
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            onScrollHandled()
          }
        }}>
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
                  <span className="material-symbols-outlined text-[10px]">edit</span>
                </button>
                <span className="text-xs text-on-surface-variant">{group.swimmers.length} swimmer{group.swimmers.length !== 1 ? 's' : ''}</span>
                {group.swimmers.length === 0 && (
                  <button onClick={() => setRemovingGroupId(group.id)}
                    className="ml-auto text-xs text-error font-semibold hover:underline cursor-pointer">Remove</button>
                )}
              </div>
              {group.swimmers.length === 0 ? (
                <p className="text-xs text-on-surface-variant text-center py-3 italic">No swimmers assigned</p>
              ) : group.swimmers.map(sw => (
                <div key={sw.id} className="flex items-center gap-3 bg-surface-container-lowest rounded-lg px-3 py-2 mb-1.5 last:mb-0">
                  <div className="w-7 h-7 rounded-full bg-primary-container/40 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    {sw.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-on-surface flex-1 min-w-0 truncate">{sw.name}</span>
                  <div className="flex items-center gap-1">
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
              ))}
              {group.swimmers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-outline-variant/30">
                  <button onClick={() => setResettingGroupId(group.id)}
                    className="text-xs text-error font-semibold flex items-center gap-1 hover:underline cursor-pointer">
                    <span className="material-symbols-outlined text-xs">refresh</span>
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
        <div className="flex gap-2 mt-4 shrink-0">
          <button onClick={() => {
            const max = state.groups.reduce((m, g) => Math.max(m, g.lane), 0)
            onAddGroup(max + 1, `Lane ${max + 1}`)
          }}
            className="flex-1 min-h-11 py-3 rounded-xl border-2 border-dashed border-outline-variant flex items-center justify-center gap-2 text-sm text-on-surface-variant hover:text-primary hover:border-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-base">add</span>
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
