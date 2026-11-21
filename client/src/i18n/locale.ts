import enMessages from './messages_en.json'
import heMessages from './messages_he.json'

export const SUPPORTED_LOCALES = ['en', 'he'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type MessageKey = keyof typeof enMessages
export type MessageParams = Record<string, string | number>

const MESSAGES: Record<Locale, Record<string, string>> = {
  en: enMessages,
  he: heMessages,
}

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return 'en'
  const base = value.split('-')[0].toLowerCase()
  return isLocale(base) ? base : 'en'
}

export function getCurrentLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('selectedLanguage')
    if (stored) return normalizeLocale(stored)
  }
  if (typeof navigator !== 'undefined') {
    return normalizeLocale(navigator.language)
  }
  return 'en'
}

export function getLocaleDir(locale: string): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr'
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}

export function translate(locale: Locale, key: string, params?: MessageParams): string {
  const message = MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key
  return interpolate(message, params)
}