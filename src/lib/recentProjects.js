/**
 * The browser's own memory of recently opened projects, so a student
 * can get back to a chart without having kept the link. This is a
 * convenience list only - the project link (and its token) is what
 * actually grants access, not this list. All access goes through
 * try/catch since localStorage can be unavailable (private browsing,
 * storage quota, browser settings) and that should never break the app.
 * @module lib/recentProjects
 */

const STORAGE_KEY = 'gantt-chart:recent-projects'
const MAX_RECENTS = 12

/**
 * @typedef {object} RecentProject
 * @property {string} id
 * @property {string} title
 * @property {string|null} editToken - null for a project only ever opened read-only
 * @property {string} lastOpened - ISO date-time string
 */

/**
 * Reads the recent projects list, newest first.
 * @returns {RecentProject[]} the stored list, or an empty list if unavailable
 */
export function loadRecentProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Records a project as recently opened, moving it to the front of the
 * list and trimming to the maximum length. Silently does nothing if
 * localStorage is unavailable.
 * @param {{id: string, title: string, editToken?: string|null}} project - the project to record
 * @returns {void}
 */
export function recordRecentProject({ id, title, editToken = null }) {
  try {
    const existing = loadRecentProjects().filter((p) => p.id !== id)
    const updated = [{ id, title, editToken, lastOpened: new Date().toISOString() }, ...existing].slice(
      0,
      MAX_RECENTS,
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Storage not available; the recent list is a convenience, not a requirement.
  }
}

/**
 * Removes a project from the recent list (it has been deleted, or the
 * student wants to tidy up), without touching the server.
 * @param {string} id - the project id to forget
 * @returns {void}
 */
export function forgetRecentProject(id) {
  try {
    const updated = loadRecentProjects().filter((p) => p.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
