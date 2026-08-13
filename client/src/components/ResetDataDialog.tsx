import { useState } from 'react'
import { resetLibraryToDefaults } from '../api/drills'
import { resetSettings, deleteAllSwimmers, deleteAllSessions } from '../api/settings'
import { Icon } from './Icon'

interface ResetDataDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

interface ResetOption {
  id: string
  label: string
  description: string
  icon: string
  enabled: boolean
}

export function ResetDataDialog({ open, onConfirm, onCancel }: ResetDataDialogProps) {
  const [resetting, setResetting] = useState(false)
  const [options, setOptions] = useState<ResetOption[]>([
    { id: 'swimmers', label: 'Delete all swimmers', description: 'Remove all swimmer profiles from your roster', icon: 'group', enabled: false },
    { id: 'sessions', label: 'Delete all session templates', description: 'Remove all training session templates', icon: 'event', enabled: false },
    { id: 'drills', label: 'Reset custom drills to defaults', description: 'Remove all custom drills and restore the default drill library', icon: 'fitness_center', enabled: false },
    { id: 'settings', label: 'Reset settings to defaults', description: 'Restore all app settings to their default values', icon: 'settings', enabled: false },
  ])

  const selectedCount = options.filter(o => o.enabled).length

  const toggleOption = (id: string) => {
    setOptions(prev => prev.map(o => 
      o.id === id ? { ...o, enabled: !o.enabled } : o
    ))
  }

  const handleConfirm = async () => {
    setResetting(true)
    try {
      if (options.find(o => o.id === 'drills' && o.enabled)) {
        await resetLibraryToDefaults()
      }
      if (options.find(o => o.id === 'settings' && o.enabled)) {
        await resetSettings()
      }
      if (options.find(o => o.id === 'swimmers' && o.enabled)) {
        await deleteAllSwimmers()
      }
      if (options.find(o => o.id === 'sessions' && o.enabled)) {
        await deleteAllSessions()
      }
      onConfirm()
    } catch {
      // Error handling is done by the caller
    } finally {
      setResetting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-4 md:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center">
            <Icon name="delete_sweep" size="xl" color="error" />
          </div>
          <div>
            <h3 className="font-headline-md text-on-surface">Reset Data</h3>
            <p className="text-sm text-on-surface-variant">Select what you want to reset</p>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {options.map(option => (
            <label
              key={option.id}
              className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                option.enabled 
                  ? 'bg-error-container/20 border border-error/30' 
                  : 'bg-surface-container hover:bg-surface-container-higher border border-transparent'
              }`}
            >
              <input
                type="checkbox"
                checked={option.enabled}
                onChange={() => toggleOption(option.id)}
                className="mt-0.5 h-5 w-5 rounded border-outline text-error focus:ring-error cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-on-surface block">{option.label}</span>
                <span className="text-xs text-on-surface-variant">{option.description}</span>
              </div>
              <Icon name={option.icon} size="lg" color={option.enabled ? 'error' : 'on-surface-variant'} />
            </label>
          ))}
        </div>

        {selectedCount > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-error-container/20 border border-error/30">
            <p className="text-sm text-error font-medium">
              You are about to reset {selectedCount} item{selectedCount !== 1 ? 's' : ''}. This action cannot be undone.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={resetting}
            className="flex-1 h-12 min-w-[44px] border-2 border-outline text-on-surface rounded-xl font-label-sm hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={resetting || selectedCount === 0}
            className="flex-1 h-12 min-w-[44px] rounded-xl font-label-sm bg-error text-on-error hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetting ? 'Resetting...' : `Reset ${selectedCount > 0 ? selectedCount : ''} Item${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
