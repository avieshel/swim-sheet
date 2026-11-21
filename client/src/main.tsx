import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { LiveSessionProvider } from './context/LiveSessionProvider'
import { LocaleProvider, getCurrentLocale, getLocaleDir } from './i18n'
import './index.css'

const initialLocale = getCurrentLocale()
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('lang', initialLocale)
  document.documentElement.setAttribute('dir', getLocaleDir(initialLocale))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider initialLocale={initialLocale}>
      <LiveSessionProvider>
        <App />
      </LiveSessionProvider>
    </LocaleProvider>
  </StrictMode>,
)
