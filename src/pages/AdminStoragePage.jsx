import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchStorageOverview } from '../services/admin.js'

/**
 * Turns a byte count into a short, human-readable size.
 * @param {number} bytes - the size in bytes
 * @returns {string} the size as, for example, "13.4 KB" or "2.1 MB"
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Formats an ISO date-time as a short UK date and time, or a dash
 * when there is none.
 * @param {string|null} iso - an ISO date-time string
 * @returns {string} the formatted date-time, or "-"
 */
function formatDateTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * A read-only storage overview for whoever holds the server's admin
 * key: every project's title, last-updated time, revision, task
 * count and file size, plus totals. Reached at `/admin/storage?key=...`.
 * Deleting or otherwise managing a project is not available here -
 * use `api/cleanup.php` for scheduled removal of old projects.
 * @returns {JSX.Element} the storage overview page
 */
function AdminStoragePage() {
  const [searchParams] = useSearchParams()
  const key = searchParams.get('key') ?? ''
  // Keyed on the admin key so a change to it (a different link, or
  // editing the URL by hand) remounts StorageOverview with a fresh
  // initial state, rather than an effect resetting state mid-flight.
  return <StorageOverview key={key} apiKey={key} />
}

/**
 * Fetches and renders the storage overview for one admin key.
 * @param {object} props
 * @param {string} props.apiKey - the admin key to fetch with, or '' when none was given
 * @returns {JSX.Element} the loading, error or ready view
 */
function StorageOverview({ apiKey }) {
  const [state, setState] = useState({ status: apiKey ? 'loading' : 'no-key', data: null, error: null })

  useEffect(() => {
    if (!apiKey) return
    let cancelled = false

    /** Fetches the storage overview for this key. */
    async function run() {
      try {
        const data = await fetchStorageOverview(apiKey)
        if (!cancelled) setState({ status: 'ready', data, error: null })
      } catch (error) {
        if (cancelled) return
        const message =
          error.response?.status === 403
            ? 'That key was not accepted.'
            : 'The storage overview could not be loaded right now.'
        setState({ status: 'error', data: null, error: message })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [apiKey])

  if (state.status === 'no-key') {
    return (
      <main className="editor-page__status">
        <p>Add <code>?key=...</code> to the URL with the server's admin key to see this page.</p>
      </main>
    )
  }

  if (state.status === 'loading') {
    return (
      <main className="editor-page__status">
        <p>Loading…</p>
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

  const { projects, stats } = state.data

  return (
    <main className="admin-page">
      <h1>Storage overview</h1>
      <p className="admin-page__stats">
        <strong>{stats.count}</strong> project{stats.count === 1 ? '' : 's'}, <strong>{formatBytes(stats.totalBytes)}</strong> in
        total. Oldest save {formatDateTime(stats.oldestUpdatedAt)}, newest {formatDateTime(stats.newestUpdatedAt)}.
      </p>

      {projects.length === 0 ? (
        <p>No projects saved on this server yet.</p>
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Last updated</th>
              <th>Tasks</th>
              <th>Revision</th>
              <th>Size</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.title}</td>
                <td>{formatDateTime(project.updatedAt)}</td>
                <td>{project.taskCount}</td>
                <td>{project.revision ?? '-'}</td>
                <td>{formatBytes(project.bytes)}</td>
                <td>
                  <Link to={`/p/${project.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}

export default AdminStoragePage
