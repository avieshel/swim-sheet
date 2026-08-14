import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

interface InfoDialogProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}

export function InfoDialog({ open, title, children, onClose }: InfoDialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center shrink-0">
            <Icon name="info" size="xl" color="primary" />
          </div>
          <h3 className="font-headline-md text-on-surface flex-1">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none"
          >
            <Icon name="close" size="md" />
          </button>
        </div>
        <div className="font-body-md text-on-surface-variant space-y-3">
          {children}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-12 min-w-[44px] px-6 rounded-xl font-label-sm bg-primary text-on-primary hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
