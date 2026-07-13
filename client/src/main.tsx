import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { LiveSessionProvider } from './context/LiveSessionProvider'
import './index.css'

import { getCurrentLocale } from './utils/locale';

// Set document direction based on locale (RTL for Hebrew)
const setDirection = (lang: string) => {
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', dir);
  }
};
setDirection(getCurrentLocale());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LiveSessionProvider>
      <App />
    </LiveSessionProvider>
  </StrictMode>,
)
