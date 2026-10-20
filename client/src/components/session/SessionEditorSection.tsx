import { useId, type ReactNode } from 'react'

interface SessionEditorSectionProps {
  title: string
  summary?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function SessionEditorSection({ title, summary, actions, children, className = '' }: SessionEditorSectionProps) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={`bg-surface-container-lowest rounded-2xl border border-outline-variant ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 id={titleId} className="font-headline-md text-headline-md text-on-surface m-0">{title}</h2>
          {summary && <div className="text-label-sm text-on-surface-variant mt-1">{summary}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
