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
//
// Offline export: scripts/export-offline.mjs embeds the dataset as
// window.__CCSC_DATA__ in a single self-contained HTML file. Web Crypto is
// unavailable on file:// URLs, so that build skips the gate entirely — the
// file itself is the secret and must be kept private.
import { DataContext } from './lib/dataContext.js'

const app = (
  <HashRouter>
    <Routes>
      <Route path="/" element={<FullBreakdown />} />
      <Route path="/summary" element={<Story />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </HashRouter>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {window.__CCSC_DATA__ ? (
      <DataContext.Provider value={window.__CCSC_DATA__}>{app}</DataContext.Provider>
    ) : (
      <PasswordGate>{app}</PasswordGate>
    )}
  </React.StrictMode>
)
