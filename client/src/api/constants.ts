import { FAMOUS_SWIMMER_NAMES, QUICK_SESSION_TEMP_SWIMMER_THRESHOLD } from '../constants'

// Catalog of locally-sourced reference data exposed through the API layer so the
// UI never imports constants directly. Maps to GET /constants/temp-swimmer-names.
export function listTempSwimmerNames(): string[] {
  return FAMOUS_SWIMMER_NAMES
}

// Random famous swimmer name for a temp (unregistered) swimmer chip.
export function pickRandomTempSwimmerName(): string {
  const names = listTempSwimmerNames()
  return names[Math.floor(Math.random() * names.length)]
}

// Roster size at which quick-start stops pre-populating hint (temp) swimmers.
export function quickSessionTempSwimmerThreshold(): number {
  return QUICK_SESSION_TEMP_SWIMMER_THRESHOLD
}
