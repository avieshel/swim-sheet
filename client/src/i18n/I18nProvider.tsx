import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, type I18nContextValue } from './context'
import { getCurrentLocale, getLocaleDir, translate, type Locale } from './locale'

function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('lang', locale)
  document.documentElement.setAttribute('dir', getLocaleDir(locale))
}

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? getCurrentLocale())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('selectedLanguage', next)
    }
  }, [])

  useEffect(() => {
    applyDocumentLocale(locale)
  }, [locale])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    dir: getLocaleDir(locale),
    t: (key, params) => translate(locale, key, params),
    setLocale,
  }), [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}