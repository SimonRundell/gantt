import { tasksToCsv } from './csvTasks.js'

/** @type {string} marks a file as UTF-8, so Excel reads accented characters correctly */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)

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
 * Triggers a browser download of some text as a file.
 * @param {string} filename - the name to save it as
 * @param {string} text - the file's contents
 * @param {string} mimeType - the file's media type, for example `text/csv`
 * @returns {void}
 */
export function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Downloads a project's tasks as a CSV file named
 * `{slug-of-title}-tasks-{yyyymmdd}.csv`. A byte order mark is added
 * so Excel reads accented characters correctly.
 * @param {{title: string, tasks: object[], dependencies: object[]}} project - the project whose tasks to export
 * @returns {void}
 */
export function downloadTasksCsv(project) {
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  downloadTextFile(`${slugify(project.title)}-tasks-${dateStamp}.csv`, `${BYTE_ORDER_MARK}${tasksToCsv(project)}`, 'text/csv')
}

/**
 * Downloads a project's tasks as an Excel workbook named
 * `{slug-of-title}-tasks-{yyyymmdd}.xlsx`.
 * @param {object} project - the project whose tasks to export
 * @param {ArrayBuffer} buffer - the workbook's file contents, from `tasksToXlsxBuffer` in `lib/xlsxTasks.js`
 * @returns {void}
 */
export function downloadTasksXlsx(project, buffer) {
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `${slugify(project.title)}-tasks-${dateStamp}.xlsx`
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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
