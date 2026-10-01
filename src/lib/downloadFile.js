/**
 * Turns a project title into a filename-safe slug.
 * @param {string} text - the text to slugify
 * @returns {string} a lowercase, hyphenated slug, or "project" if nothing usable remains
 */
export function slugify(text) {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
  return slug || 'project'
}

/**
 * Triggers a browser download of a project document as a `.json`
 * file, named `{slug-of-title}-{yyyymmdd}.json` as the brief asks for.
 * @param {object} project - the project document to download
 * @returns {void}
 */
export function downloadProjectJson(project) {
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `${slugify(project.title)}-${dateStamp}.json`
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
