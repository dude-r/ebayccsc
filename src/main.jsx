import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles.css'
import PasswordGate from './components/PasswordGate.jsx'
import FullBreakdown from './pages/FullBreakdown.jsx'
import Story from './pages/Story.jsx'

// The report is gated: nothing renders (and no data is available) until the
// viewer unlocks it with the correct password. HashRouter keeps deep links
// working on any static host without server rewrite rules.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PasswordGate>
      <HashRouter>
        <Routes>
          <Route path="/" element={<FullBreakdown />} />
          <Route path="/summary" element={<Story />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </PasswordGate>
  </React.StrictMode>
)
