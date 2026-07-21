import { FAMOUS_SWIMMER_NAMES } from '../constants'

// Catalog of locally-sourced reference data exposed through the API layer so the
// UI never imports constants directly. Maps to GET /constants/temp-swimmer-names.
export function listTempSwimmerNames(): string[] {
  return FAMOUS_SWIMMER_NAMES
}
