// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { LocaleProvider, useI18n, getLocaleDir, translate } from '../index'
import en from '../messages_en.json'

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('lang')
})

beforeEach(() => {
  localStorage.clear()
})

function Probe() {
  const { locale, dir, t, setLocale } = useI18n()
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="title">{t('settings.title')}</span>
      <span data-testid="missing">{t('nonexistent.key' as never)}</span>
      <button onClick={() => setLocale('he')}>he</button>
      <button onClick={() => setLocale('en')}>en</button>
    </div>
  )
}

describe('getLocaleDir', () => {
  it('returns rtl for Hebrew and ltr otherwise', () => {
    expect(getLocaleDir('he')).toBe('rtl')
    expect(getLocaleDir('en')).toBe('ltr')
    expect(getLocaleDir('fr')).toBe('ltr')
  })
})

describe('translate', () => {
  it('returns English message by default', () => {
    expect(translate('en', 'settings.title')).toBe(en['settings.title'])
  })

  it('returns Hebrew message for he locale', () => {
    expect(translate('he', 'settings.title')).toBe('הגדרות')
  })

  it('falls back to English when key missing in locale', () => {
    expect(translate('he', 'nonexistent.key' as never)).toBe('nonexistent.key')
  })

  it('interpolates params on fallback key', () => {
    expect(translate('en', 'hello {name}' as never, { name: 'Avi' })).toBe('hello Avi')
  })
})

describe('LocaleProvider/useI18n', () => {
  it('defaults to English and sets html lang/dir', () => {
    render(<LocaleProvider><Probe /></LocaleProvider>)
    expect(screen.getByTestId('locale').textContent).toBe('en')
    expect(screen.getByTestId('dir').textContent).toBe('ltr')
    expect(screen.getByTestId('title').textContent).toBe('Settings')
    expect(document.documentElement.getAttribute('lang')).toBe('en')
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
  })

  it('uses stored selectedLanguage', () => {
    localStorage.setItem('selectedLanguage', 'he')
    render(<LocaleProvider><Probe /></LocaleProvider>)
    expect(screen.getByTestId('locale').textContent).toBe('he')
    expect(screen.getByTestId('dir').textContent).toBe('rtl')
    expect(screen.getByTestId('title').textContent).toBe('הגדרות')
    expect(document.documentElement.getAttribute('lang')).toBe('he')
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
  })

  it('setLocale updates locale, document, and localStorage', async () => {
    render(<LocaleProvider><Probe /></LocaleProvider>)
    await act(async () => {
      screen.getByText('he').click()
    })
    expect(screen.getByTestId('locale').textContent).toBe('he')
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    expect(document.documentElement.getAttribute('lang')).toBe('he')
    expect(localStorage.getItem('selectedLanguage')).toBe('he')
  })

  it('falls back to key when missing everywhere', () => {
    render(<LocaleProvider><Probe /></LocaleProvider>)
    expect(screen.getByTestId('missing').textContent).toBe('nonexistent.key')
  })
})