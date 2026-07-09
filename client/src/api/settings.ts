import { settingsService } from '../services/settingsService'

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

export const DEFAULT_EQUIPMENT = settingsService.DEFAULT_EQUIPMENT
