import { getAllSwimmers, searchSwimmers, getSwimmer, addSwimmer, updateSwimmer, deleteSwimmer, deleteSwimmerWithData, exportSwimmerData } from '../db/dao'
import type { SafeSwimmer } from '../db/schema'

export const swimmerService = {
  list: () => getAllSwimmers(),
  search: (query: string) => searchSwimmers(query),
  get: (id: string) => getSwimmer(id),
  create: (data: SafeSwimmer) => addSwimmer(data),
  update: (id: string, data: Partial<SafeSwimmer>) => updateSwimmer(id, data),
  delete: (id: string) => deleteSwimmer(id),
  deleteWithData: (id: string) => deleteSwimmerWithData(id),
  exportData: (id: string) => exportSwimmerData(id),
}
