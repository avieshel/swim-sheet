export const PERSIST_FLAG_KEY = 'swimsheet-auth-persist'
export const SESSION_STORAGE_KEY = 'sb-swimsheet-auth-token'

export function isPersistEnabled(): boolean {
  return localStorage.getItem(PERSIST_FLAG_KEY) !== '0'
}

export function setPersistEnabled(enabled: boolean): void {
  localStorage.setItem(PERSIST_FLAG_KEY, enabled ? '1' : '0')
  const unselected = enabled ? sessionStorage : localStorage
  unselected.removeItem(SESSION_STORAGE_KEY)
}

function activeStore(): Storage {
  return isPersistEnabled() ? localStorage : sessionStorage
}

export function createAuthStorage(): Storage {
  return {
    getItem: (key: string) => activeStore().getItem(key),
    setItem: (key: string, value: string) => activeStore().setItem(key, value),
    removeItem: (key: string) => activeStore().removeItem(key),
    key: (index: number) => activeStore().key(index),
    clear: () => activeStore().clear(),
    get length() {
      return activeStore().length
    },
  }
}
