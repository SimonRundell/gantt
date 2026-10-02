import { Route, Routes } from 'react-router-dom'
import CMFloatAd from './components/CMFloatAd.jsx'
import EditorPage from './pages/EditorPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PrintPage from './pages/PrintPage.jsx'

/**
 * Top level route table for the application.
 * @returns {JSX.Element} the routed application shell
 */
function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/p/:id" element={<EditorPage />} />
        <Route path="/print/:id" element={<PrintPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <CMFloatAd />
    </>
  )
}

export default App
