import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { RouteMeta } from './components/RouteMeta'
import { UpdatePrompt } from './components/UpdatePrompt'
import { Landing } from './pages/Landing'
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
import { Events, analytics, isNewSession } from './services/analyticsEvents'
import { testSupabaseConnection } from './api/supabase'

function App() {
  useEffect(() => {
    if (isNewSession()) {
      analytics.track(Events.AppOpened())
    }
    void testSupabaseConnection()
  }, [])
  return (
    <Router>
      <RouteMeta />
      <Routes>
        <Route path="/about" element={<Landing />} />
        <Route element={<Layout />}>
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
        </Route>
      </Routes>
      <UpdatePrompt />
    </Router>
  )
}

export default App
