import { useParams } from 'react-router-dom'

/**
 * Main chart editor, reached at /p/:id. Edit mode requires a valid token
 * in the query string or a stored token for this project; otherwise the
 * chart opens read-only. Fleshed out in a later build phase.
 * @returns {JSX.Element} the editor page
 */
function EditorPage() {
  const { id } = useParams()

  return (
    <main className="editor-page">
      <h1>Project {id}</h1>
      <p>The editor is being built out across the next few phases.</p>
    </main>
  )
}

export default EditorPage
