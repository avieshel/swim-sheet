import React, { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}) => {
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
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-sm rounded-2xl p-4 md:p-6 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full mx-auto mb-4 flex items-center justify-center ${destructive ? 'bg-error-container' : 'bg-primary-container'}">
          <span className={`material-symbols-outlined text-2xl md:text-3xl ${destructive ? 'text-error' : 'text-primary'}`}>
            {destructive ? 'delete' : 'help_outline'}
          </span>
        </div>
        <h3 className="font-headline-md text-on-surface mb-2">{title}</h3>
        <p className="font-body-md text-on-surface-variant mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-12 min-w-[44px] border-2 border-outline text-on-surface rounded-xl font-label-sm hover:bg-surface-container transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 h-12 min-w-[44px] rounded-xl font-label-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer ${
              destructive
                ? 'bg-error text-on-error'
                : 'bg-primary text-on-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
