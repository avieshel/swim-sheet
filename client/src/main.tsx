import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LiveSessionProvider } from './context/LiveSessionProvider'
import { seedLibraryDrills, patchLibraryDrills } from './db/dao'

seedLibraryDrills()
patchLibraryDrills()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LiveSessionProvider>
      <App />
    </LiveSessionProvider>
  </StrictMode>,
)
