import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles.css'
import FullBreakdown from './pages/FullBreakdown.jsx'
import Story from './pages/Story.jsx'

// HashRouter keeps deep links working on any static host without server
// rewrite rules — matches the "no backend, host anywhere" intent.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<FullBreakdown />} />
        <Route path="/summary" element={<Story />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
