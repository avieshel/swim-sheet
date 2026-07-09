import { getEquipmentOptions, setEquipmentOptions, estimateDbSize, cleanupOldData, DEFAULT_EQUIPMENT as _DEFAULT } from '../db/dao'

export const settingsService = {
  getEquipmentOptions: () => getEquipmentOptions(),
  setEquipmentOptions: (items: string[]) => setEquipmentOptions(items),
  estimateDbSize: () => estimateDbSize(),
  cleanupOldData: (retentionDays: number) => cleanupOldData(retentionDays),
  DEFAULT_EQUIPMENT: _DEFAULT,
}
