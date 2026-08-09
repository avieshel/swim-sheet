import { getAllSwimmers, searchSwimmers, getSwimmer, addSwimmer, updateSwimmer, deleteSwimmer, deleteSwimmerWithData, exportSwimmerData } from '../db/dao'
import type { SafeSwimmer } from '../db/schema'

export const swimmerService = {
  list: () => getAllSwimmers(),
  search: (query: string) => searchSwimmers(query),
  get: (id: string) => getSwimmer(id),
  create: (data: SafeSwimmer) => addSwimmer(data),
  createIfNotExists: async (data: SafeSwimmer): Promise<string> => {
    const existing = await searchSwimmers(data.name)
    if (existing.length > 0) {
      throw new Error(`A swimmer named "${data.name}" already exists. Please use a different name.`)
    }
    return addSwimmer(data)
  },
  update: (id: string, data: Partial<SafeSwimmer>) => updateSwimmer(id, data),
  delete: (id: string) => deleteSwimmer(id),
  deleteWithData: (id: string) => deleteSwimmerWithData(id),
  exportData: (id: string) => exportSwimmerData(id),
}
