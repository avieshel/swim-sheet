import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { UpdatePrompt } from './components/UpdatePrompt'
import { SwimmersList } from './pages/SwimmersList'
import { SwimmerDetail } from './pages/SwimmerDetail'
import { SessionsList } from './pages/SessionsList'
import { SessionDetail } from './pages/SessionDetail'
import { CatalogScreen } from './pages/CatalogScreen'
import { DrillBank } from './pages/DrillBank'
// import { DrillDetail } from './pages/DrillDetail'
import { CoachDashboard } from './pages/CoachDashboard'
import { LiveDeck } from './pages/LiveDeck'
import { Settings } from './pages/Settings'
import { RunsHistory } from './pages/RunsHistory'
import { RunDetail } from './pages/RunDetail'
import { analytics } from './services/analyticsService'
import { testSupabaseConnection } from './api/supabase'

function App() {
  useEffect(() => {
    const sessionId = localStorage.getItem('swimsheet_session_id')
    const sessionStart = Number(localStorage.getItem('swimsheet_session_start') || '0')
    const now = Date.now()
    const isNewSession = !sessionId || now - sessionStart > 30 * 60 * 1000

    if (isNewSession) {
      analytics.track('app_opened', { timestamp: now })
    }
    void testSupabaseConnection()
  }, [])
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<LiveDeck />} />
          <Route path="/dashboard" element={<CoachDashboard />} />
          <Route path="/swimmers" element={<SwimmersList />} />
          <Route path="/swimmers/:id" element={<SwimmerDetail />} />
          <Route path="/sessions" element={<SessionsList />} />
          <Route path="/sessions/catalog" element={<CatalogScreen />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/drills" element={<DrillBank />} />
          {/* <Route path="/drills/:id" element={<DrillDetail />} /> */}
          <Route path="/live" element={<LiveDeck />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/runs" element={<RunsHistory />} />
          <Route path="/runs/:id" element={<RunDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <UpdatePrompt />
      </Layout>
    </Router>
  )
}

export default App
