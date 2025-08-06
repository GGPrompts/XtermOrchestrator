import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
// import MultiTerminal from './pages/MultiTerminal' // DISABLED - Legacy system
import OrchestratorTerminal from './pages/OrchestratorTerminal'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // React.StrictMode disabled to prevent duplicate WebSocket connections in development
  // This avoids multiple terminal instances and duplicate command executions
  <Router>
    <Routes>
      <Route path="/" element={<App />} />
      {/* <Route path="/multi-terminal" element={<MultiTerminal />} /> DISABLED - Legacy system */}
      <Route path="/multi-terminal" element={<Navigate to="/orchestrator" replace />} />
      <Route path="/orchestrator" element={<OrchestratorTerminal />} />
      {/* Catch-all route for any unmatched paths - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Router>
)