export function isSystemSession(notes: string): boolean {
  try {
    return JSON.parse(notes)?.system === true
  } catch {
    return false
  }
}
