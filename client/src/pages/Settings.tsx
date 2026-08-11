import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, updateSettings, resetSettings, getEquipmentOptions, setEquipmentOptions, estimateDbSize, cleanupOldData, DEFAULT_EQUIPMENT } from '../api/settings'
import { getAppVersion } from '../utils/version'
import { CustomSelect } from '../components/CustomSelect'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ResetDataDialog } from '../components/ResetDataDialog'

interface SettingsForm {
  team_name: string
  coach_name: string
  team_names: string[]
  pool_length: string
  distance_units: string
  notification_enabled: boolean
  sync_interval: string
  theme: string
  font_size: string
  auto_save: boolean
  data_retention_days: string
}

const SEA_CREATURES = [
  'Sharks', 'Stingrays', 'Dolphins', 'Whales', 'Seals',
  'Orcas', 'Barracudas', 'Marlins', 'Turtles', 'Manatees',
  'Otters', 'Penguins', 'Lobsters', 'Crabs', 'Starfish',
]

function suggestTeamNames(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return []
  const possessive = trimmed.endsWith('s') ? `${trimmed}'` : `${trimmed}'s`
  const shuffled = [...SEA_CREATURES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 5).map(c => `${possessive} ${c}`)
}

export const Settings: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SettingsForm>({
    team_name: '',
    coach_name: '',
    team_names: [],
    pool_length: '25',
    distance_units: 'meters',
    notification_enabled: true,
    sync_interval: '30000',
    theme: 'auto',
    font_size: 'medium',
    auto_save: true,
    data_retention_days: '90',
  })
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showResetDataDialog, setShowResetDataDialog] = useState(false)
  const [poolLengthPreset, setPoolLengthPreset] = useState<'25' | '50' | 'custom'>('25')
  const [poolLengthCustom, setPoolLengthCustom] = useState('25')

  // Team names state
  const [newTeamName, setNewTeamName] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Equipment state
  const [equipmentItems, setEquipmentItems] = useState<string[]>(DEFAULT_EQUIPMENT)
  const [newEquipName, setNewEquipName] = useState('')

  // Storage state
  const [storageInfo, setStorageInfo] = useState<{ bytes: number; tables: Record<string, number> } | null>(null)
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null)
  const [cleaningUp, setCleaningUp] = useState(false)

  useEffect(() => {
    if (showResetConfirm) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [showResetConfirm])

  useEffect(() => {
    getSettings().then(data => {
      const pl = data.pool_length || 25
      setForm({
        team_name: data.team_name || '',
        coach_name: data.coach_name || '',
        team_names: data.team_names || [],
        pool_length: pl.toString(),
        distance_units: data.distance_units || 'meters',
        notification_enabled: !!data.notification_enabled,
        sync_interval: (data.sync_interval || 30000).toString(),
        theme: data.theme === 'light' ? 'pool' : (data.theme || 'auto'),
        font_size: data.font_size || 'medium',
        auto_save: !!data.auto_save,
        data_retention_days: (data.data_retention_days || 90).toString(),
      })
      if (pl === 25) {
        setPoolLengthPreset('25')
      } else if (pl === 50) {
        setPoolLengthPreset('50')
      } else {
        setPoolLengthPreset('custom')
        setPoolLengthCustom(pl.toString())
      }
      if (data.theme && data.theme !== 'auto') {
        document.documentElement.dataset.theme = data.theme
      }
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    getEquipmentOptions().then(setEquipmentItems)
  }, [])

  useEffect(() => {
    estimateDbSize().then(setStorageInfo)
  }, [])

  const handleTeamNameAdd = () => {
    const name = newTeamName.trim()
    if (!name || form.team_names.includes(name)) return
    setForm(prev => ({ ...prev, team_names: [...prev.team_names, name] }))
    setNewTeamName('')
    setSuggestions([])
  }

  const handleTeamNameRemove = (item: string) => {
    setForm(prev => ({ ...prev, team_names: prev.team_names.filter(i => i !== item) }))
  }

  const handleCoachNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setForm(prev => ({ ...prev, coach_name: val }))
    setSuggestions(suggestTeamNames(val))
  }

  const handleEquipAdd = () => {
    const name = newEquipName.trim().toLowerCase()
    if (!name || equipmentItems.includes(name)) return
    const updated = [...equipmentItems, name]
    setEquipmentItems(updated)
    setEquipmentOptions(updated)
    setNewEquipName('')
  }

  const handleEquipRemove = (item: string) => {
    const updated = equipmentItems.filter(i => i !== item)
    setEquipmentItems(updated)
    setEquipmentOptions(updated)
  }

  const handleEquipReset = () => {
    setEquipmentItems(DEFAULT_EQUIPMENT)
    setEquipmentOptions(DEFAULT_EQUIPMENT)
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleCleanup = async () => {
    setCleaningUp(true)
    setCleanupMsg(null)
    try {
      const deleted = await cleanupOldData(Number(form.data_retention_days))
      setCleanupMsg(`Cleaned up ${deleted} old session(s)`)
      const info = await estimateDbSize()
      setStorageInfo(info)
    } catch (err) {
      setCleanupMsg('Cleanup failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setCleaningUp(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const poolLength = poolLengthPreset === 'custom'
      ? Math.min(100, Math.max(1, Number(poolLengthCustom) || 25))
      : Number(poolLengthPreset)
    await updateSettings({
      team_name: form.team_name,
      coach_name: form.coach_name,
      team_names: form.team_names,
      pool_length: poolLength,
      distance_units: 'meters',
      notification_enabled: form.notification_enabled,
      sync_interval: Number(form.sync_interval),
      theme: form.theme,
      font_size: form.font_size,
      auto_save: form.auto_save,
      data_retention_days: Number(form.data_retention_days),
    })
    navigate('/')
    setSaving(false)
  }

  const handleReset = async () => {
    await resetSettings()
    setForm({
      team_name: '',
      coach_name: '',
      team_names: [],
      pool_length: '25',
      distance_units: 'meters',
      notification_enabled: true,
      sync_interval: '30000',
      theme: 'auto',
      font_size: 'medium',
      auto_save: true,
      data_retention_days: '90',
    })
    setPoolLengthPreset('25')
    setPoolLengthCustom('25')
    setShowResetConfirm(false)
    navigate('/')
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-on-surface-variant">Loading settings...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4 md:mb-8">
        <h1 className="font-headline-lg font-bold text-primary mb-2 md:mb-4">Settings</h1>
        <p className="text-on-surface-variant font-body-md md:font-body-lg">Customize your SwimSheet experience</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
        {/* Profile Settings */}
        <section>
          <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">Coach Profile</h2>
          <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
            <div className="space-y-4">
              <div>
                <label htmlFor="coach_name" className="font-label-sm text-on-surface block mb-2">
                  Coach Name
                </label>
                <input
                  type="text"
                  id="coach_name"
                  name="coach_name"
                  value={form.coach_name}
                  onChange={handleCoachNameChange}
                  placeholder="e.g. Alex"
                  className="w-full bg-surface text-on-surface px-4 py-3 rounded-xl border border-outline-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="font-label-sm text-on-surface block mb-2">
                  Teams
                </label>
                <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
                  {form.team_names.map(item => (
                    <div key={item} className="flex items-center gap-1 bg-surface-variant text-on-surface-variant px-3 py-1.5 rounded-full text-sm font-bold">
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => handleTeamNameRemove(item)}
                        className="ml-1 text-on-surface-variant hover:text-error transition-colors cursor-pointer bg-transparent border-none p-0 leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleTeamNameAdd() } }}
                    placeholder="Add a team..."
                    className="flex-1 bg-surface text-on-surface px-4 py-2.5 rounded-xl border border-outline-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleTeamNameAdd}
                    disabled={!newTeamName.trim()}
                    className="bg-primary text-on-primary font-bold px-4 py-2.5 rounded-xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 cursor-pointer border-none text-sm"
                  >
                    Add
                  </button>
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-on-surface-variant mb-1.5">Suggestions based on coach name:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            if (!form.team_names.includes(s)) {
                              setForm(prev => ({ ...prev, team_names: [...prev.team_names, s] }))
                            }
                            setSuggestions([])
                          }}
                          className="text-xs px-2.5 py-1 rounded-full bg-primary-container/40 text-primary hover:bg-primary-container/70 transition-colors cursor-pointer border-none"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Application Preferences */}
        <section>
          <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">Application Preferences</h2>
          <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
            <div className="space-y-4">
              <div>
                <label className="font-label-sm text-on-surface block mb-2">
                  Default Pool Length
                </label>
                <CustomSelect
                  value={poolLengthPreset}
                  options={[
                    { value: '25', label: '25m' },
                    { value: '50', label: '50m' },
                    { value: 'custom', label: `${poolLengthCustom}m` },
                  ]}
                  onChange={(val) => {
                    const v = val as '25' | '50' | 'custom'
                    setPoolLengthPreset(v)
                    const num = v === 'custom' ? Number(poolLengthCustom) : Number(v)
                    if (v !== 'custom' || (num >= 1 && num <= 100)) {
                      setForm(prev => ({ ...prev, pool_length: String(num) }))
                      updateSettings({ pool_length: num })
                    }
                  }}
                />
                {poolLengthPreset === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={poolLengthCustom}
                      onChange={e => {
                        const val = e.target.value
                        setPoolLengthCustom(val)
                        const num = Number(val)
                        if (num >= 1 && num <= 100) {
                          setForm(prev => ({ ...prev, pool_length: val }))
                          updateSettings({ pool_length: num })
                        }
                      }}
                      className={`w-24 bg-surface px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-center font-bold ${
                        Number(poolLengthCustom) < 1 || Number(poolLengthCustom) > 100
                          ? 'border-error text-error bg-error-container/10'
                          : 'text-on-surface border-outline-variant focus:border-primary'
                      }`}
                    />
                    <span className="text-on-surface-variant font-body-md">meters</span>
                    {Number(poolLengthCustom) < 1 || Number(poolLengthCustom) > 100 ? (
                      <span className="text-error text-label-sm font-bold">1–100m</span>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="font_size" className="font-label-sm text-on-surface block mb-2">
                  Font Size
                </label>
                <select
                  id="font_size"
                  name="font_size"
                  value={form.font_size}
                  onChange={handleInputChange}
                  className="w-full bg-surface text-on-surface px-4 py-3 rounded-xl border border-outline-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="font-label-sm text-on-surface">
                  Auto-save Sessions
                </label>
                <input
                  type="checkbox"
                  id="auto_save"
                  name="auto_save"
                  checked={form.auto_save}
                  onChange={handleInputChange}
                  className="w-12 h-6 bg-surface rounded-full border border-outline-variant appearance-none cursor-pointer peer-checked:bg-primary"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Sync Settings */}
        <section>
          <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">Equipment</h2>
          <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {equipmentItems.map(item => (
                  <div key={item} className="flex items-center gap-1 bg-surface-variant text-on-surface-variant px-3 py-1.5 rounded-full text-sm font-bold">
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => handleEquipRemove(item)}
                      className="ml-1 text-on-surface-variant hover:text-error transition-colors cursor-pointer bg-transparent border-none p-0 leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newEquipName}
                  onChange={e => setNewEquipName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleEquipAdd() } }}
                  placeholder="Add equipment item..."
                  className="flex-1 bg-surface text-on-surface px-4 py-2.5 rounded-xl border border-outline-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={handleEquipAdd}
                  disabled={!newEquipName.trim()}
                  className="bg-primary text-on-primary font-bold px-4 py-2.5 rounded-xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 cursor-pointer border-none text-sm"
                >
                  Add
                </button>
              </div>
              <button
                type="button"
                onClick={handleEquipReset}
                className="text-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer bg-transparent border-none underline"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </section>

        {/* Sync Settings */}
        <section>
          <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">Sync Settings</h2>
          <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
            <div className="space-y-4">
              <div>
                <label htmlFor="sync_interval" className="font-label-sm text-on-surface block mb-2">
                  Auto-sync Interval (seconds)
                </label>
                <input
                  type="number"
                  id="sync_interval"
                  name="sync_interval"
                  value={form.sync_interval}
                  onChange={handleInputChange}
                  min="10000"
                  step="1000"
                  className="w-full bg-surface text-on-surface px-4 py-3 rounded-xl border border-outline-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="font-label-sm text-on-surface">
                  Enable Notifications
                </label>
                <input
                  type="checkbox"
                  id="notification_enabled"
                  name="notification_enabled"
                  checked={form.notification_enabled}
                  onChange={handleInputChange}
                  className="w-12 h-6 bg-surface rounded-full border border-outline-variant appearance-none cursor-pointer peer-checked:bg-primary"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section>
          <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">Data Management</h2>
          <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
            <div className="space-y-4">
              {storageInfo && (
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                  <span className="font-label-sm text-on-surface">Storage Used</span>
                  <div className="text-right">
                    <span className="font-body-md font-bold text-on-surface">{formatBytes(storageInfo.bytes)}</span>
                    <div className="text-xs text-on-surface-variant">
                      {Object.entries(storageInfo.tables)
                        .filter(([, bytes]) => bytes > 0)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 4)
                        .map(([name, bytes]) => `${name}: ${formatBytes(bytes)}`)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="data_retention_days" className="font-label-sm text-on-surface block mb-2">
                  Auto-cleanup older than (days)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    id="data_retention_days"
                    name="data_retention_days"
                    value={form.data_retention_days}
                    onChange={handleInputChange}
                    min="30"
                    max="365"
                    className="flex-1 bg-surface text-on-surface px-4 py-3 rounded-xl border border-outline-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleCleanup}
                    disabled={cleaningUp}
                    className="bg-surface-variant text-on-surface-variant font-bold px-4 py-3 rounded-xl hover:bg-surface transition-all active:scale-95 disabled:opacity-50 cursor-pointer border-none"
                  >
                    {cleaningUp ? '...' : 'Clean'}
                  </button>
                </div>
                {cleanupMsg && (
                  <p className="text-sm text-on-surface-variant mt-1">{cleanupMsg}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="flex-1 bg-surface-variant text-on-surface-variant font-bold px-6 py-4 rounded-xl hover:bg-surface transition-all active:scale-95 cursor-pointer border-none"
                >
                  Reset Settings
                </button>

                <button
                  type="button"
                  onClick={() => setShowResetDataDialog(true)}
                  className="flex-1 bg-error-container text-on-error-container font-bold px-6 py-4 rounded-xl hover:bg-error transition-all active:scale-95 cursor-pointer border-none"
                >
                  Reset Data
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary text-white font-bold px-6 py-4 rounded-xl hover:shadow-xl hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <ConfirmDialog
          open={showResetConfirm}
          title="Reset Settings?"
          message="This will restore all settings to their default values. This action cannot be undone."
          confirmLabel="Reset"
          cancelLabel="Cancel"
          destructive={false}
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />

        <ResetDataDialog
          open={showResetDataDialog}
          onConfirm={() => {
            setShowResetDataDialog(false)
            setCleanupMsg('Data has been reset')
            estimateDbSize().then(setStorageInfo)
            setTimeout(() => navigate('/'), 1000)
          }}
          onCancel={() => setShowResetDataDialog(false)}
        />
      </form>

      {/* Language & Theme */}
      <section>
        <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">App Configuration</h2>
        <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
          <div className="space-y-4">
            <div>
              <label className="font-label-sm text-on-surface block mb-2">
                Application Language
              </label>
              <CustomSelect
                value={localStorage.getItem('selectedLanguage') || 'en'}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'he', label: 'עברית', badge: <span className="text-caption-caps font-bold px-1 py-0.5 rounded bg-amber-200 text-amber-800">Beta</span> },
                ]}
                onChange={(val) => {
                  localStorage.setItem('selectedLanguage', val as string);
                  window.location.reload();
                }}
              />
            </div>
            <div>
              <label htmlFor="theme" className="font-label-sm text-on-surface block mb-2">
                Theme
              </label>
              <CustomSelect
                value={form.theme}
                options={[
                  { value: 'pool', label: 'Pool (Light)' },
                  { value: 'open-water', label: 'Open Water (Dark)' },
                  { value: 'auto', label: 'Automatic' },
                ]}
                onChange={(val) => {
                  const newEvent = { target: { name: 'theme', value: val } } as React.ChangeEvent<HTMLSelectElement>
                  handleInputChange(newEvent)
                  if (val === 'auto') {
                    delete document.documentElement.dataset.theme
                  } else {
                    document.documentElement.dataset.theme = val as string
                  }
                }}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* App Info */}
      <section className="mt-8">
        <h2 className="font-label-caps text-primary mb-4 px-3">App Info</h2>
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface">Version</span>
            <span className="font-body-md text-on-surface-variant">{getAppVersion().version}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface">Commit</span>
            <span className="font-body-md text-on-surface-variant">{getAppVersion().commit}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface">Built</span>
            <span className="font-body-md text-on-surface-variant">{getAppVersion().built.replace('T', ' ').replace(/\.\d+Z/, '')} UTC</span>
          </div>
        </div>
      </section>
    </div>
  )
}