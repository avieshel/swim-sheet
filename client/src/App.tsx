import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { SyncStatus } from './components/SyncStatus'
import { UpdatePrompt } from './components/UpdatePrompt'
import { SwimmersList } from './pages/SwimmersList'
import { SwimmerDetail } from './pages/SwimmerDetail'
import { SessionsList } from './pages/SessionsList'
import { SessionDetail } from './pages/SessionDetail'
import { DrillBank } from './pages/DrillBank'
import { DrillDetail } from './pages/DrillDetail'
import { CoachDashboard } from './pages/CoachDashboard'
import { LiveDeck } from './pages/LiveDeck'
import { Settings } from './pages/Settings'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<LiveDeck />} />
          <Route path="/dashboard" element={<CoachDashboard />} />
          <Route path="/swimmers" element={<SwimmersList />} />
          <Route path="/swimmers/:id" element={<SwimmerDetail />} />
          <Route path="/sessions" element={<SessionsList />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/drills" element={<DrillBank />} />
          <Route path="/drills/:id" element={<DrillDetail />} />
          <Route path="/live" element={<LiveDeck />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SyncStatus />
        <UpdatePrompt />
      </Layout>
    </Router>
  )
}

export default App
