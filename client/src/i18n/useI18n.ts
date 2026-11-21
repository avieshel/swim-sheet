import { useContext } from 'react'
import { DEFAULT_I18N, I18nContext, type I18nContextValue } from './context'

export function useI18n(): I18nContextValue {
  return useContext(I18nContext) ?? DEFAULT_I18N
}