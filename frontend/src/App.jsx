import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AnalyzePage from './pages/AnalyzePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<LandingPage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
      </Routes>
    </BrowserRouter>
  )
}