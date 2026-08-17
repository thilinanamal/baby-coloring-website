import { Routes, Route, Navigate } from 'react-router-dom'
import Gallery from './pages/Gallery'
import ColorPage from './pages/ColorPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Gallery />} />
      <Route path="/color/:id" element={<ColorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
