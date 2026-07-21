import { getEquipmentOptions, setEquipmentOptions, estimateDbSize, cleanupOldData, DEFAULT_EQUIPMENT, deleteAllData } from '../db/dao'

const SETTINGS_KEY = 'swimsheet-settings'

export interface SettingsData {
  team_name: string
  coach_name: string
  team_names: string[]
  pool_length: number
  distance_units: string
  notification_enabled: boolean
  sync_interval: number
  theme: string
  font_size: string
  auto_save: boolean
  data_retention_days: number
}

const DEFAULT_SETTINGS: SettingsData = {
  team_name: '',
  coach_name: '',
  team_names: [],
  pool_length: 25,
  distance_units: 'meters',
  notification_enabled: true,
  sync_interval: 30000,
  theme: 'auto',
  font_size: 'medium',
  auto_save: true,
  data_retention_days: 90,
}

function readStorage(): SettingsData {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeStorage(data: SettingsData): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
}

export const settingsService = {
  getSettings: () => Promise.resolve(readStorage()),
  updateSettings: (patch: Partial<SettingsData>) => {
    const current = readStorage()
    writeStorage({ ...current, ...patch })
    return Promise.resolve()
  },
  resetSettings: () => {
    localStorage.removeItem(SETTINGS_KEY)
    return Promise.resolve()
  },
  getEquipmentOptions: () => getEquipmentOptions(),
  setEquipmentOptions: (items: string[]) => setEquipmentOptions(items),
  estimateDbSize: () => estimateDbSize(),
  cleanupOldData: (retentionDays: number) => cleanupOldData(retentionDays),
  deleteAllData: () => deleteAllData(),
  DEFAULT_EQUIPMENT,
}
