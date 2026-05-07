import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import AnalyzePage from './pages/AnalyzePage'
import AuthPage from './pages/AuthPage'
import DoctorPortal from './pages/DoctorPortal'
import ReportsPage from './pages/ReportsPage'

function RequireAuth({ isAuthed, children }) {
  if (!isAuthed) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem('pv_auth') === '1')

  const handleAuth = (value) => {
    setIsAuthed(value)
    if (value) localStorage.setItem('pv_auth', '1')
      else {
    localStorage.removeItem('pv_auth')
    localStorage.removeItem('user')   // ← ADD THIS LINE
  }
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthed ? <Navigate to="/" replace /> : <AuthPage onAuth={handleAuth} />
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth isAuthed={isAuthed}>
              <LandingPage onLogout={() => handleAuth(false)} />
            </RequireAuth>
          }
        />
        <Route
          path="/analyze"
          element={
            <RequireAuth isAuthed={isAuthed}>
              <AnalyzePage />
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth isAuthed={isAuthed}>
              <ReportsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/doctor"
          element={<DoctorPortal />}
        />
      </Routes>
    </BrowserRouter>
  )
}