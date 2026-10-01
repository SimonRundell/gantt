import { useParams } from 'react-router-dom'

/**
 * Print-friendly rendering of a chart, reached at /print/:id. Fleshed
 * out alongside the export phase of the build.
 * @returns {JSX.Element} the print page
 */
function PrintPage() {
  const { id } = useParams()

  return (
    <main className="print-page">
      <h1>Project {id}</h1>
      <p>Print view is not built yet.</p>
    </main>
  )
}

export default PrintPage
