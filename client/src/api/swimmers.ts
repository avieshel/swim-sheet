import { swimmerService } from '../services/swimmerService'
import type { SafeSwimmer, Swimmer } from '../db/schema'

export function listSwimmers(): Promise<Swimmer[]> {
  return swimmerService.list()
}

export function searchSwimmers(query: string): Promise<Swimmer[]> {
  return swimmerService.search(query)
}

export function getSwimmer(id: string): Promise<Swimmer | undefined> {
  return swimmerService.get(id)
}

export function createSwimmer(data: SafeSwimmer): Promise<string> {
  return swimmerService.create(data)
}

export function updateSwimmer(id: string, data: Partial<SafeSwimmer>): Promise<void> {
  return swimmerService.update(id, data)
}

export function deleteSwimmer(id: string): Promise<void> {
  return swimmerService.delete(id)
}

export function deleteSwimmerWithData(id: string): Promise<Blob | null> {
  return swimmerService.deleteWithData(id)
}

export function exportSwimmerData(id: string): Promise<Blob> {
  return swimmerService.exportData(id)
}
