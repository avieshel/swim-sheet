import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, updateSettings, resetSettings, getEquipmentOptions, setEquipmentOptions, estimateDbSize, cleanupOldData, exportDatabase, importDatabase, getBackupInfo, getStoragePersistence, requestStoragePersistence, DEFAULT_EQUIPMENT } from '../api/settings'
import { getAppVersion } from '../utils/version'
import { downloadBlob } from '../utils/downloadBlob'
import { CustomSelect } from '../components/CustomSelect'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ResetDataDialog } from '../components/ResetDataDialog'
import { InfoDialog } from '../components/InfoDialog'
import { Icon } from '../components/Icon'

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
  const [poolLengthValue, setPoolLengthValue] = useState('25')
  const [poolLengthCustom, setPoolLengthCustom] = useState('')

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

  // Backup state
  const [persistenceGranted, setPersistenceGranted] = useState<boolean | null>(null)
  const [showStorageInfo, setShowStorageInfo] = useState(false)
  const [backupInfo, setBackupInfo] = useState<{ savedAt: string } | null>(() => getBackupInfo())
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)

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
      setPoolLengthValue(pl.toString())
      if (pl !== 25 && pl !== 50) {
        setPoolLengthCustom(pl.toString())
      }
      if (data.theme && data.theme !== 'auto') {
        document.documentElement.dataset.theme = data.theme
      }
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (form.font_size === 'medium') {
      delete document.documentElement.dataset.fontSize
    } else {
      document.documentElement.dataset.fontSize = form.font_size
    }
  }, [form.font_size])

  useEffect(() => {
    getEquipmentOptions().then(setEquipmentItems)
  }, [])

  useEffect(() => {
    estimateDbSize().then(setStorageInfo)
  }, [])

  useEffect(() => {
    getStoragePersistence().then(setPersistenceGranted)
  }, [])

  const handleTeamNameAdd = () => {
    const name = newTeamName.trim()
    if (!name || form.team_names.includes(name)) return
    const updated = [...form.team_names, name]
    setForm(prev => ({ ...prev, team_names: updated }))
    void updateSettings({ team_names: updated })
    setNewTeamName('')
    setSuggestions([])
  }

  const handleTeamNameRemove = (item: string) => {
    const updated = form.team_names.filter(i => i !== item)
    setForm(prev => ({ ...prev, team_names: updated }))
    void updateSettings({ team_names: updated })
  }

  const handleCoachNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setForm(prev => ({ ...prev, coach_name: val }))
    void updateSettings({ coach_name: val })
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

  const handleExport = async () => {
    setExporting(true)
    setBackupMsg(null)
    try {
      const json = await exportDatabase()
      const blob = new Blob([json], { type: 'application/json' })
      const date = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `swimsheet-backup-${date}.json`)
      setBackupInfo(getBackupInfo())
    } catch (err) {
      setBackupMsg('Export failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportFile(file)
    setShowImportConfirm(true)
  }

  const handleImportConfirm = async () => {
    if (!importFile) return
    setImporting(true)
    setBackupMsg(null)
    try {
      const json = await importFile.text()
      await importDatabase(json)
      setShowImportConfirm(false)
      window.location.reload()
    } catch (err) {
      setImporting(false)
      setBackupMsg('Import failed: ' + (err instanceof Error ? err.message : 'invalid backup file'))
      setShowImportConfirm(false)
    }
  }

  const handleRequestPersistence = async () => {
    const granted = await requestStoragePersistence()
    setPersistenceGranted(granted)
    setBackupMsg(granted ? 'Storage protection enabled' : 'Storage protection was not granted')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
    if (name === 'sync_interval') {
      void updateSettings({ sync_interval: Number(value) })
    } else if (name === 'notification_enabled') {
      void updateSettings({ notification_enabled: (e.target as HTMLInputElement).checked })
    } else if (name === 'data_retention_days') {
      void updateSettings({ data_retention_days: Number(value) })
    } else if (name === 'font_size') {
      void updateSettings({ font_size: value })
    }
  }

  const handleFontSizeChange = (size: string) => {
    setForm(prev => ({ ...prev, font_size: size }))
    void updateSettings({ font_size: size })
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
    setPoolLengthValue('25')
    setPoolLengthCustom('')
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.fontSize
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

      <div className="space-y-6 md:space-y-8">
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

        {/* General App Settings */}
        <section>
          <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">General App Settings</h2>
          <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
            <div className="space-y-4">
              <div>
                <label className="font-label-sm text-on-surface block mb-2">
                  Default Pool Length
                </label>
                <div className="flex items-center flex-wrap gap-2">
                  {[25, 50].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        const s = String(v)
                        setPoolLengthValue(s)
                        setForm(prev => ({ ...prev, pool_length: s }))
                        updateSettings({ pool_length: v })
                      }}
                      className={`h-9 md:h-10 px-4 rounded-xl text-label-sm font-bold transition-all cursor-pointer border ${
                        Number(poolLengthValue) === v && poolLengthValue === String(v)
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface text-on-surface-variant/50 border-outline-variant hover:border-primary/50'
                      }`}
                    >
                      {v}m
                    </button>
                  ))}
                  <div className={`flex items-center gap-1 rounded-xl border overflow-hidden transition-all ${
                    Number(poolLengthValue) !== 25 && Number(poolLengthValue) !== 50
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface text-on-surface border-outline-variant focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
                  }`}>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="1–100"
                      value={poolLengthCustom}
                      onChange={e => {
                        const val = e.target.value
                        setPoolLengthCustom(val)
                        const num = Number(val)
                        if (num >= 1 && num <= 100) {
                          setPoolLengthValue(val)
                          setForm(prev => ({ ...prev, pool_length: val }))
                          updateSettings({ pool_length: num })
                        }
                      }}
                      className={`w-20 px-2 py-2 bg-transparent text-sm tabular-nums text-center outline-none border-none ${
                        Number(poolLengthValue) !== 25 && Number(poolLengthValue) !== 50
                          ? 'text-on-primary'
                          : 'text-on-surface'
                      }`}
                    />
                    <span className={`text-sm pr-2 ${
                      Number(poolLengthValue) !== 25 && Number(poolLengthValue) !== 50
                        ? 'text-on-primary'
                        : 'text-on-surface-variant'
                    }`}>m</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-label-sm text-on-surface block mb-2">
                  Default Equipment
                </label>
                <div className="flex flex-wrap gap-2 min-h-[2rem] mb-2">
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
          </div>
        </section>

        {/* Application Preferences */}
        <section>
          <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">Application Preferences</h2>
          <div className="bg-surface-container-lowest rounded-2xl p-4 md:p-6 border border-outline-variant">
            <div className="space-y-4">
              <div>
                <label className="font-label-sm text-on-surface block mb-2">
                  Font Size
                </label>
                <div className="flex items-center gap-2">
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleFontSizeChange(size)}
                      className={`h-9 md:h-10 px-4 rounded-xl text-label-sm font-bold capitalize transition-all cursor-pointer border ${
                        form.font_size === size
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface text-on-surface-variant/50 border-outline-variant hover:border-primary/50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
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
                    void updateSettings({ theme: String(val) })
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-label-sm text-on-surface block mb-2">
                  Language
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

              <div className="border-t border-outline-variant/30 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-label-sm text-on-surface">Reset Settings</span>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="h-9 px-3 bg-surface-variant text-on-surface-variant text-label-sm font-bold rounded-xl hover:bg-surface transition-all active:scale-95 cursor-pointer border-none"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section>
          <h2 className="font-label-caps text-primary mb-3 md:mb-4 px-3">Data Management</h2>
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

              <div className="border-t border-outline-variant/30 pt-4">
                <div className="flex items-center justify-between gap-3 pb-2">
                  <span className="flex items-center gap-1.5 font-label-sm text-on-surface">
                    Storage Protection
                    <button
                      type="button"
                      onClick={() => setShowStorageInfo(true)}
                      aria-label="What does storage protection mean?"
                      className="w-6 h-6 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none"
                    >
                      <Icon name="info" size="sm" />
                    </button>
                  </span>
                  <span className="flex items-center gap-3 text-right">
                    <span className="font-body-md text-on-surface-variant">
                      {persistenceGranted === null ? 'Checking...' : persistenceGranted ? (
                        <span className="flex items-center gap-1.5">
                          <Icon name="check_circle" size="sm" color="primary" fill />
                          <span>Protected from automatic eviction</span>
                        </span>
                      ) : 'Not protected — browser may evict data'}
                    </span>
                    {!persistenceGranted && (
                      <button
                        type="button"
                        onClick={handleRequestPersistence}
                        className="bg-primary text-on-primary font-bold px-4 py-2 rounded-xl hover:brightness-110 transition-all active:scale-95 cursor-pointer border-none text-sm whitespace-nowrap"
                      >
                        Request protection
                      </button>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2">
                  <span className="font-label-sm text-on-surface">Last Automatic Backup</span>
                  <span className="font-body-md text-on-surface-variant">
                    {backupInfo ? new Date(backupInfo.savedAt).toLocaleString() : 'Never'}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant pb-3">
                  SwimSheet keeps an automatic backup on this device. Back up to a file to keep a copy outside this browser (for example, before switching devices).
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex-1 bg-surface-variant text-on-surface-variant font-bold px-4 py-3 rounded-xl hover:bg-surface transition-all active:scale-95 disabled:opacity-50 cursor-pointer border-none"
                  >
                    {exporting ? 'Exporting...' : 'Back up to file'}
                  </button>
                  <label className="flex-1 bg-surface-variant text-on-surface-variant font-bold px-4 py-3 rounded-xl hover:bg-surface transition-all active:scale-95 cursor-pointer border-none text-center">
                    Restore from file
                    <input type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
                  </label>
                </div>
                {backupMsg && (
                  <p className="text-sm text-on-surface-variant mt-1">{backupMsg}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetDataDialog(true)}
                  className="flex-1 bg-error-container text-on-error-container font-bold px-6 py-4 rounded-xl hover:bg-error transition-all active:scale-95 cursor-pointer border-none"
                >
                  Reset Data
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

        <ConfirmDialog
          open={showImportConfirm}
          title="Restore from backup?"
          message="This will replace ALL current data (swimmers, session templates, completed sessions, results) with the contents of the backup file. This cannot be undone."
          confirmLabel="Restore"
          cancelLabel="Cancel"
          destructive
          confirmDisabled={importing}
          onConfirm={handleImportConfirm}
          onCancel={() => setShowImportConfirm(false)}
        />

        <InfoDialog
          open={showStorageInfo}
          title="Storage Protection"
          onClose={() => setShowStorageInfo(false)}
        >
          <p>
            SwimSheet stores all of your data on this device, inside the browser's storage. Browsers can
            sometimes delete this data to free up space when your phone or tablet runs low — this is called
            "automatic eviction."
          </p>
          <p>
            <strong>Storage Protection</strong> asks the browser to mark SwimSheet as important, so it won't
            be automatically evicted. When protection is active, your swimmers, session templates, and
            completed results are much more likely to survive low-storage pressure.
          </p>
          <p className="rounded-xl bg-surface-container p-3 text-sm">
            A green check means this device's browser has granted protection. On iOS, installing the app to
            your home screen and opening it regularly strengthens this protection. If it can't be granted,
            your data is still backed up automatically and you can always use <strong>Back up to file</strong>{' '}
            below for a copy you control.
          </p>
        </InfoDialog>
      </div>

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