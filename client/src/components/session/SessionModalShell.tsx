import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Icon } from '../Icon'

interface SessionModalShellProps {
  title: string
  children: ReactNode
  onClose: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  restoreFocusRef?: RefObject<HTMLElement | null>
  size?: 'compact' | 'wide'
  layer?: 'base' | 'raised'
  dismissOnBackdrop?: boolean
}

export function SessionModalShell({
  title,
  children,
  onClose,
  initialFocusRef,
  restoreFocusRef,
  size = 'compact',
  layer = 'base',
  dismissOnBackdrop = false,
}: SessionModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTarget = restoreFocusRef?.current ?? previousFocus
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    initialFocusRef?.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      focusTarget?.focus()
    }
  }, [initialFocusRef, restoreFocusRef])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable?.item(0)
    const last = focusable?.item(focusable.length - 1)
    if (!first || !last) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const sizeClass = size === 'wide' ? 'max-w-[min(95vw,56rem)]' : 'max-w-lg'
  const layerClass = layer === 'raised' ? 'z-[60]' : 'z-50'

  return (
    <div
      className={`fixed inset-0 ${layerClass} flex items-center justify-center bg-black/50 backdrop-blur-sm p-4`}
      onClick={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className={`w-full ${sizeClass} max-h-[90dvh] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl animate-fade-in`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-6 md:pt-6">
          <h2 id={titleId} className="font-headline-md text-headline-md text-on-surface m-0">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-11 w-11 inline-flex shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
