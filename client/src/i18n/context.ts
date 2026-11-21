import { createContext } from 'react'
import type { Locale, MessageKey, MessageParams } from './locale'
import { translate } from './locale'

export interface I18nContextValue {
  locale: Locale
  dir: 'ltr' | 'rtl'
  t: (key: MessageKey | (string & {}), params?: MessageParams) => string
  setLocale: (locale: Locale) => void
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export const DEFAULT_I18N: I18nContextValue = {
  locale: 'en',
  dir: 'ltr',
  t: (key, params) => translate('en', key, params),
  setLocale: () => {},
}