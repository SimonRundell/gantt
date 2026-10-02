import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatUKDate } from '../lib/dates.js'
import { migrate } from '../lib/migrate.js'
import { loadRecentProjects, recordRecentProject } from '../lib/recentProjects.js'
import { TEMPLATES } from '../lib/templates.js'
import { sanitizeForImport, validateProject } from '../lib/validate.js'
import { createProject } from '../services/projects.js'
import Icon from '../components/Icon.jsx'

/** @type {Record<string, string>} icon shown on each starter template card, by template id */
const TEMPLATE_ICONS = { esp: 'calendar', 'web-sprint': 'rocket', blank: 'file' }

/**
 * The home page: start a new chart, pick a template, open a recent
 * project from this browser, or upload a saved `.json` file.
 * @returns {JSX.Element} the home page
 */
function HomePage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const recents = loadRecentProjects()

  /**
   * Creates a project on the server from an optional seed document and
   * navigates to its editor, remembering it in this browser's recent list.
   * @param {object|null} seedProject - a partial project document, or null for a blank project
   * @param {boolean} [showShare] - whether to open the share dialog straight away (not wanted for example charts)
   * @returns {Promise<void>} resolves once navigation has started
   */
  async function createAndOpen(seedProject, showShare = true) {
    setBusy(true)
    setError(null)
    try {
      const { id, editToken, project } = await createProject(seedProject)
      recordRecentProject({ id, title: project.title, editToken })
      navigate(`/p/${id}?k=${editToken}`, { state: { justCreated: showShare } })
    } catch {
      setError('Could not create a new chart right now. Check your connection and try again.')
      setBusy(false)
    }
  }

  /**
   * Reads an uploaded `.json` file, validates it, and if it looks like
   * a genuine project, creates a new server copy from it.
   * @param {import('react').ChangeEvent<HTMLInputElement>} event - the file input change event
   * @returns {Promise<void>} resolves once the upload has been handled
   */
  async function handleUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    const text = await file.text()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      setError('That file is not valid JSON, so it could not be read.')
      return
    }

    const migrated = migrate(parsed)
    if (!migrated.ok) {
      setError(migrated.error)
      return
    }

    const result = validateProject(migrated.doc)
    if (!result.valid) {
      setError(`This file has some problems: ${result.problems.join(' ')}`)
      return
    }

    await createAndOpen(sanitizeForImport(migrated.doc))
  }

  return (
    <div className="home">
      <header className="home__hero">
        <div className="home__hero-inner">
          <h1>Gantt Chart Planner</h1>
          <p>
            Plan your coursework project, share the link with yourself or your group, and come back to it any
            time.
          </p>
        </div>
      </header>
      <main className="home-page">
        {error && (
          <p className="home-page__error" role="alert">
            {error}
          </p>
        )}

        <section className="home-page__section">
          <h2>Start a new chart</h2>
          <div className="home-page__template-grid">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className="home-page__template-card"
                disabled={busy}
                onClick={() => createAndOpen(template.build(), template.id === 'blank')}
              >
                <span className="home-page__template-icon">
                  <Icon name={TEMPLATE_ICONS[template.id] ?? 'file'} />
                </span>
                <strong>{template.name}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-page__section">
          <h2>Open a saved file</h2>
          <p>
            Have a chart saved as a <code>.json</code> file? Open it here.
          </p>
          <button type="button" className="btn" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" />
            Upload a .json file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="home-page__file-input"
            onChange={handleUpload}
            aria-label="Upload a project file"
          />
        </section>

        {recents.length > 0 && (
          <section className="home-page__section">
            <h2>Recent charts</h2>
            <ul className="home-page__recent-list">
              {recents.map((recent) => (
                <li key={recent.id}>
                  <a href={recent.editToken ? `/p/${recent.id}?k=${recent.editToken}` : `/p/${recent.id}`}>
                    {recent.title || 'Untitled project'}
                  </a>
                  <span className="home-page__recent-date">
                    Opened {formatUKDate(recent.lastOpened.slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

export default HomePage
