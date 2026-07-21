import { settingsService } from '../services/settingsService'
import type { SettingsData } from '../services/settingsService'

export function getSettings(): Promise<SettingsData> {
  return settingsService.getSettings()
}

export function updateSettings(patch: Partial<SettingsData>): Promise<void> {
  return settingsService.updateSettings(patch)
}

export function resetSettings(): Promise<void> {
  return settingsService.resetSettings()
}

export function getEquipmentOptions(): Promise<string[]> {
  return settingsService.getEquipmentOptions()
}

export function setEquipmentOptions(items: string[]): Promise<void> {
  return settingsService.setEquipmentOptions(items)
}

export function estimateDbSize(): Promise<{ bytes: number; tables: Record<string, number> }> {
  return settingsService.estimateDbSize()
}

export function cleanupOldData(retentionDays: number): Promise<number> {
  return settingsService.cleanupOldData(retentionDays)
}

export function deleteAllData(): Promise<void> {
  return settingsService.deleteAllData()
}

export const DEFAULT_EQUIPMENT = settingsService.DEFAULT_EQUIPMENT
