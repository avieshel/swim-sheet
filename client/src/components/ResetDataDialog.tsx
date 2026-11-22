import { useState } from 'react'
import { resetLibraryToDefaults } from '../api/drills'
import { resetSettings, deleteAllSwimmers, deleteAllSessions } from '../api/settings'
import { Icon } from './Icon'
import { useI18n } from '../i18n'

interface ResetDataDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

type ResetOptionId = 'swimmers' | 'sessions' | 'drills' | 'settings'

interface ResetOptionState {
  id: ResetOptionId
  icon: string
  enabled: boolean
}

const INITIAL_OPTIONS: ResetOptionState[] = [
  { id: 'swimmers', icon: 'group', enabled: false },
  { id: 'sessions', icon: 'event', enabled: false },
  { id: 'drills', icon: 'fitness_center', enabled: false },
  { id: 'settings', icon: 'settings', enabled: false },
]

export function ResetDataDialog({ open, onConfirm, onCancel }: ResetDataDialogProps) {
  const { t } = useI18n()
  const [resetting, setResetting] = useState(false)
  const [options, setOptions] = useState<ResetOptionState[]>(INITIAL_OPTIONS)

  const labels: Record<ResetOptionId, { label: string; description: string }> = {
    swimmers: { label: t('resetData.swimmers'), description: t('resetData.swimmersDesc') },
    sessions: { label: t('resetData.sessions'), description: t('resetData.sessionsDesc') },
    drills: { label: t('resetData.drills'), description: t('resetData.drillsDesc') },
    settings: { label: t('resetData.settings'), description: t('resetData.settingsDesc') },
  }

  const selectedCount = options.filter(o => o.enabled).length

  const toggleOption = (id: ResetOptionId) => {
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

  const suffix = selectedCount !== 1 ? 's' : ''

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
            <h3 className="font-headline-md text-on-surface">{t('resetData.title')}</h3>
            <p className="text-sm text-on-surface-variant">{t('resetData.subtitle')}</p>
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
                <span className="text-sm font-medium text-on-surface block">{labels[option.id].label}</span>
                <span className="text-xs text-on-surface-variant">{labels[option.id].description}</span>
              </div>
              <Icon name={option.icon} size="lg" color={option.enabled ? 'error' : 'on-surface-variant'} />
            </label>
          ))}
        </div>

        {selectedCount > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-error-container/20 border border-error/30">
            <p className="text-sm text-error font-medium">
              {t('resetData.warning', { count: selectedCount, suffix })}
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
            {t('resetData.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={resetting || selectedCount === 0}
            className="flex-1 h-12 min-w-[44px] rounded-xl font-label-sm bg-error text-on-error hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetting ? t('resetData.resetting') : selectedCount > 0 ? t('resetData.resetItems', { count: selectedCount, suffix }) : t('resetData.resetItemsEmpty')}
          </button>
        </div>
      </div>
    </div>
  )
}