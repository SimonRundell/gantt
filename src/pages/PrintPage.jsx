import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import FullChartView from '../components/FullChartView.jsx'
import { getProject } from '../services/projects.js'

/**
 * Print-friendly rendering of a chart, reached at /print/:id. Shows
 * the whole chart (every row, the whole date range) with no editing
 * controls, and a Print button that calls window.print(). The actual
 * page setup (A4 landscape, margins, hiding this button) lives in
 * app.css under @media print.
 * @returns {JSX.Element} the print page
 */
function PrintPage() {
  const { id } = useParams()
  const [state, setState] = useState({ status: 'loading', project: null, error: null })

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const project = await getProject(id)
        if (!cancelled) setState({ status: 'ready', project, error: null })
      } catch {
        if (!cancelled) {
          setState({ status: 'error', project: null, error: 'This chart could not be loaded for printing.' })
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [id])

  if (state.status === 'loading') {
    return (
      <main className="editor-page__status">
        <p>Loading chart…</p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="editor-page__status">
        <p>{state.error}</p>
      </main>
    )
  }

  return (
    <main className="print-page">
      <button type="button" className="print-page__button no-print" onClick={() => window.print()}>
        Print this chart
      </button>
      <FullChartView project={state.project} />
    </main>
  )
}

export default PrintPage
