import { useState, type ReactNode } from 'react'
import { Icon } from '../Icon'
import { EquipmentIcons, type EquipmentType } from '../EquipmentIcons'

// The planning-side drill list. It borrows the live overview's visual
// language (components/live/DrillsSection.tsx) — numbered rows, a single
// compact subtitle line, an inset fold for details — so a session reads the
// same before and during a run. There are no progress affordances here; the
// fold holds only what a coach reviews before starting.
const FOLD_BOX = 'ml-8 md:ml-11 mr-4 md:mr-5 mb-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/30 overflow-hidden'

export interface DrillsListStep {
  label: string
  text: string
  interval?: string
  intensity?: string
}

export interface DrillsListRow {
  id: string
  name: string
  repeatCount: number
  distance: number
  subtitle: string
  description?: string
  badges: string[]
  equipment: EquipmentType[]
  steps: DrillsListStep[]
  onEdit?: () => void
  onDelete?: () => void
  canDelete?: boolean
  onMove?: (direction: -1 | 1) => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

interface DrillsListProps {
  title: string
  summary?: ReactNode
  actions?: ReactNode
  headerExtra?: ReactNode
  footer?: ReactNode
  rows: DrillsListRow[]
  emptyMessage?: ReactNode
  className?: string
}

function rowTitle(row: Pick<DrillsListRow, 'name' | 'repeatCount'>): string {
  return row.repeatCount > 1 ? `${row.repeatCount} × ${row.name}` : row.name
}

function hasFoldContent(row: DrillsListRow): boolean {
  return row.steps.length > 1 || Boolean(row.description?.trim()) || row.badges.length > 0
}

type RowState = DrillsListRow & {
  toggleExpanded: () => void
  expanded: boolean
  canFold: boolean
}

function RowControls({ row }: { row: RowState }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {row.onMove && (
        <>
          <button
            onClick={() => row.onMove!(-1)}
            disabled={row.canMoveUp === false}
            aria-label={`Move ${row.name} up`}
            className="w-6 h-6 flex items-center justify-center rounded-full text-outline hover:text-primary disabled:opacity-30 transition-colors cursor-pointer bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="keyboard_arrow_up" size="sm" />
          </button>
          <button
            onClick={() => row.onMove!(1)}
            disabled={row.canMoveDown === false}
            aria-label={`Move ${row.name} down`}
            className="w-6 h-6 flex items-center justify-center rounded-full text-outline hover:text-primary disabled:opacity-30 transition-colors cursor-pointer bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="keyboard_arrow_down" size="sm" />
          </button>
        </>
      )}
      {row.onEdit && (
        <button
          onClick={row.onEdit}
          aria-label={`Edit drill: ${row.name}`}
          className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <Icon name="edit" size="sm" />
        </button>
      )}
      {row.onDelete && (
        <button
          onClick={row.onDelete}
          disabled={row.canDelete === false}
          aria-label={`Remove drill: ${row.name}`}
          className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-error disabled:opacity-30 transition-colors cursor-pointer bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error rounded-full"
        >
          <Icon name="delete" size="sm" />
        </button>
      )}
      {row.canFold && (
        <button
          onClick={row.toggleExpanded}
          aria-label={row.expanded ? `Hide details for ${row.name}` : `Show details for ${row.name}`}
          className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <Icon name={row.expanded ? 'expand_more' : 'chevron_right'} size="sm" />
        </button>
      )}
    </div>
  )
}

function RowDetail({ row }: { row: DrillsListRow }) {
  return (
    <div className={FOLD_BOX}>
      {row.steps.length > 1 && (
        <div className="pt-0.5 pb-2">
          {row.steps.map(step => (
            <div key={step.label} className="flex items-center gap-2 py-1 pr-6 pl-3">
              <span className="text-label-sm font-semibold tabular-nums w-5 shrink-0 text-on-surface-variant">
                {step.label}
              </span>
              <span className="text-label-sm text-on-surface truncate">{step.text}</span>
              {step.interval && <span className="text-label-sm text-primary shrink-0">@ {step.interval}</span>}
              {step.intensity && <span className="text-label-sm text-secondary shrink-0">{step.intensity}</span>}
            </div>
          ))}
        </div>
      )}
      {(row.description?.trim() || row.badges.length > 0) && (
        <div
          className={`px-3 pb-3 pt-2 text-label-sm text-on-surface-variant space-y-2 ${
            row.steps.length > 1 ? 'border-t border-outline-variant/20' : ''
          }`}
        >
          {row.description?.trim() && (
            <p className="text-on-surface/90">
              <span className="font-semibold text-on-surface block mb-0.5">Description</span>
              {row.description}
            </p>
          )}
          {row.badges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.badges.map(badge => (
                <span
                  key={badge}
                  className="text-caption-caps bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded uppercase"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ row, index }: { row: DrillsListRow; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const toggleExpanded = () => setExpanded(value => !value)
  const canFold = hasFoldContent(row)
  const expandedRow: RowState = { ...row, toggleExpanded, expanded, canFold }
  const hasEquipment = row.equipment.length > 0

  return (
    <div className="transition-colors hover:bg-surface-container-low/50">
      <div className="flex items-center justify-between gap-3 p-3 md:p-4">
        <span className="text-label-sm text-on-surface-variant tabular-nums w-5 shrink-0">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-on-surface truncate">{rowTitle(row)}</span>
            {hasEquipment && (
              <span className="inline-flex items-center text-primary" title={row.equipment.join(', ')}>
                <EquipmentIcons type={row.equipment[0]} className="w-4 h-4" />
              </span>
            )}
          </div>
          <div className="text-label-sm text-on-surface-variant">{row.subtitle}</div>
        </div>
        <RowControls row={expandedRow} />
      </div>
      {expanded && <RowDetail row={row} />}
    </div>
  )
}

export function DrillsList({ title, summary, actions, headerExtra, footer, rows, emptyMessage, className = '' }: DrillsListProps) {
  const totalMeters = rows.reduce((sum, row) => sum + row.distance, 0)
  return (
    <div
      role="region"
      aria-label={title}
      className={`rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between gap-3 p-3.5 md:p-4">
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-headline-sm text-on-surface">{title}</span>
          <span className="text-label-sm text-on-surface-variant font-medium tabular-nums">
            {rows.length > 0 ? `${rows.length} drills · ${totalMeters}m` : 'No drills'}
          </span>
          {summary}
        </span>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {headerExtra}
      {rows.length > 0 ? (
        <div className="divide-y divide-outline-variant/10 border-t border-outline-variant/20">
          {rows.map((row, index) => (
            <Row key={row.id} row={row} index={index} />
          ))}
        </div>
      ) : (
        <div className="border-t border-outline-variant/20 px-4 py-10 text-center">
          {emptyMessage ?? <p className="text-label-sm text-on-surface-variant">No drills yet.</p>}
        </div>
      )}
      {footer && <div className="border-t border-outline-variant/20 px-3.5 md:p-4 pb-3.5 md:pb-4">{footer}</div>}
    </div>
  )
}
