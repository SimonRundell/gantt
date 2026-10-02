/**
 * Converts a project's tasks to and from CSV, so a plan can be edited
 * in a spreadsheet or brought in from another tool.
 *
 * Columns: Row, Level, Name, Type, Start, Duration (working days),
 * Percent complete, Assignee, Colour, Notes, Predecessors.
 * - Level is the indent: 0 for a top level task, 1 for a task inside a
 *   group, and so on. A row's parent is the nearest row above it with a
 *   lower level.
 * - Predecessors are row numbers with an optional type and lag, such as
 *   `3`, `3FS+2` or `5SS-1`, separated by semicolons or commas.
 * @module lib/csvTasks
 */

import { snapForwardToWorkingDay } from './calendar.js'
import { TASK_COLOURS } from './constants.js'
import { parseCsv, protectCell, stringifyCsv, unprotectCell } from './csv.js'
import { isValidISODate } from './dates.js'
import { generateId } from './id.js'
import { applyDependencies, detectCycle, rollUpGroups } from './scheduler.js'
import { createBlankProject } from './sampleProject.js'
import { buildChildrenMap } from './taskTree.js'

/** @type {number} the most tasks one import may add, matching the server's default limit */
export const MAX_IMPORT_TASKS = 1000

/** @type {number} how many warnings are listed before the rest are summarised */
const MAX_WARNINGS = 15

/** @type {string[]} the column headings written on export */
export const CSV_HEADINGS = [
  'Row',
  'Level',
  'Name',
  'Type',
  'Start',
  'Duration (working days)',
  'Percent complete',
  'Assignee',
  'Colour',
  'Notes',
  'Predecessors',
]

/** @type {Record<string, string[]>} accepted heading names (lower case, letters and digits only) for each field */
const HEADING_ALIASES = {
  row: ['row', 'id', 'no', 'number', 'index'],
  level: ['level', 'outlinelevel', 'indent', 'depth'],
  name: ['name', 'task', 'taskname', 'title', 'activity'],
  type: ['type', 'kind'],
  start: ['start', 'startdate', 'begin'],
  duration: ['duration', 'durationworkingdays', 'durationdays', 'days', 'workingdays'],
  percent: ['percent', 'percentcomplete', 'complete', 'progress', 'completion'],
  assignee: ['assignee', 'assignedto', 'resource', 'resourcenames', 'owner'],
  colour: ['colour', 'color'],
  notes: ['notes', 'note', 'comments', 'description'],
  predecessors: ['predecessors', 'predecessor', 'dependson', 'dependencies'],
}

/**
 * Reduces a heading to lower case letters and digits for matching.
 * @param {string} heading - a heading cell
 * @returns {string} the normalised heading
 */
function normaliseHeading(heading) {
  return heading
    .toLowerCase()
    .replace(/%/g, 'percent')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Lists every task in outline order (children straight after their
 * parent, whether or not the group is collapsed), with its depth.
 * @param {import('./scheduler.js').Task[]} tasks - every task in the project
 * @returns {{task: import('./scheduler.js').Task, depth: number}[]} the tasks in outline order
 */
function outlineOrder(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const children = buildChildrenMap(tasks)
  const result = []

  /**
   * Adds a task and then its children.
   * @param {string} id - the task id
   * @param {number} depth - how deep it sits
   * @returns {void}
   */
  const visit = (id, depth) => {
    result.push({ task: byId.get(id), depth })
    for (const childId of children.get(id) ?? []) visit(childId, depth + 1)
  }

  for (const rootId of children.get(null) ?? []) visit(rootId, 0)
  return result
}

/**
 * Writes a project's tasks as CSV text.
 * @param {{tasks: import('./scheduler.js').Task[], dependencies: import('./scheduler.js').Dependency[]}} project - the project to export
 * @returns {string} CSV text, one row per task in outline order
 */
export function tasksToCsv(project) {
  const outline = outlineOrder(project.tasks)
  const rowById = new Map(outline.map(({ task }, index) => [task.id, index + 1]))

  const predecessorsFor = (taskId) =>
    project.dependencies
      .filter((d) => d.to === taskId && rowById.has(d.from))
      .map((d) => {
        const lag = d.lagDays ?? 0
        return `${rowById.get(d.from)}${d.type}${lag === 0 ? '' : lag > 0 ? `+${lag}` : lag}`
      })
      .join('; ')

  const rows = outline.map(({ task, depth }, index) => [
    String(index + 1),
    String(depth),
    protectCell(task.name),
    task.type,
    task.start,
    task.type === 'milestone' ? '0' : String(task.durationDays),
    String(task.percent),
    protectCell(task.assignee ?? ''),
    task.colour,
    protectCell(task.notes ?? ''),
    predecessorsFor(task.id),
  ])

  return stringifyCsv([CSV_HEADINGS, ...rows])
}

/**
 * Reads a date typed as `YYYY-MM-DD` or in UK style (`d/m/yyyy`,
 * `d-m-yy`, `d.m.yyyy`).
 * @param {string} text - the cell text
 * @returns {string|null} the date as `YYYY-MM-DD`, or null if it is not a valid date
 */
export function parseCsvDate(text) {
  const value = text.trim()
  if (isValidISODate(value)) return value

  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value)
  if (!match) return null
  const [, day, month, rawYear] = match
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  return isValidISODate(iso) ? iso : null
}

/**
 * Reads one predecessor entry such as `3`, `3FS`, `3SS+2` or `5FF-1d`.
 * @param {string} text - one entry
 * @returns {{row: number, type: string, lagDays: number}|null} the parsed entry, or null if it is not understood
 */
export function parsePredecessor(text) {
  const match = /^(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\s*\d+)?\s*(?:d|days?)?$/i.exec(text.trim())
  if (!match) return null
  return {
    row: Number(match[1]),
    type: (match[2] ?? 'FS').toUpperCase(),
    lagDays: match[3] ? Number(match[3].replace(/\s/g, '')) : 0,
  }
}

/**
 * Matches a colour typed as a palette name (any case) to its stored value.
 * @param {string} text - the cell text
 * @returns {string} a palette colour value, `blue` when nothing matches
 */
function parseColour(text) {
  const wanted = text.trim().toLowerCase()
  const match = TASK_COLOURS.find((c) => c.value === wanted || c.label.toLowerCase() === wanted)
  return match ? match.value : 'blue'
}

/**
 * @typedef {object} CsvImportResult
 * @property {import('./scheduler.js').Task[]} tasks - the new tasks (not yet scheduled)
 * @property {import('./scheduler.js').Dependency[]} dependencies - the new dependencies between them
 * @property {string[]} warnings - things that were fixed or ignored, in plain English
 * @property {string[]} errors - problems that stop the import (when there are any, `tasks` is empty)
 */

/**
 * Reads CSV text into new tasks and dependencies. Anything it cannot
 * use is reported as a warning rather than stopping the import, apart
 * from missing headings, too many rows, or predecessors that form a loop.
 * @param {string} text - the CSV text
 * @param {object} options
 * @param {string} options.defaultStart - the start date for rows that have none or an unreadable one, `YYYY-MM-DD`
 * @returns {CsvImportResult} the parsed tasks, dependencies, warnings and errors
 */
export function parseTasksCsv(text, { defaultStart }) {
  const warnings = []
  const fail = (message) => ({ tasks: [], dependencies: [], warnings, errors: [message] })

  const allRows = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ''))
  if (allRows.length < 2) return fail('The file has no tasks in it. The first row should be headings, then one row per task.')

  const headingRow = allRows[0].map(normaliseHeading)
  const column = {}
  for (const [field, aliases] of Object.entries(HEADING_ALIASES)) {
    const index = headingRow.findIndex((heading) => aliases.includes(heading))
    if (index !== -1) column[field] = index
  }
  if (column.name === undefined) {
    return fail('There is no Name column. The first row should contain headings such as Name, Start and Duration.')
  }

  /**
   * Gets the trimmed text of one field from a row.
   * @param {string[]} row - the row
   * @param {string} field - the field name
   * @returns {string} the text, or an empty string if the column is missing
   */
  const cell = (row, field) => (column[field] === undefined ? '' : unprotectCell((row[column[field]] ?? '').trim()))

  const dataRows = allRows.slice(1)
  if (dataRows.length > MAX_IMPORT_TASKS) {
    return fail(`The file has ${dataRows.length} rows, but a chart can hold at most ${MAX_IMPORT_TASKS} tasks.`)
  }

  const tasks = []
  const rowKeyToId = new Map()
  const predecessorText = []
  const stack = [] // the chain of ancestors of the row being read: {level, id}
  let previousLevel = -1
  let badStarts = 0

  dataRows.forEach((row, rowIndex) => {
    const sourceRow = rowIndex + 2
    const name = cell(row, 'name').slice(0, 200)
    if (name === '') {
      warnings.push(`Row ${sourceRow} has no name, so it was skipped.`)
      return
    }

    let level = 0
    const levelText = cell(row, 'level')
    if (levelText !== '') {
      const parsed = Number(levelText)
      if (Number.isInteger(parsed) && parsed >= 0) level = parsed
      else warnings.push(`"${name}" has a Level that is not a whole number, so it was placed at the top level.`)
    }
    if (level > previousLevel + 1) {
      if (level > 0) warnings.push(`"${name}" is indented more than one level below the row above, so it was moved up to fit.`)
      level = previousLevel + 1
    }
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop()
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : null

    const typeText = cell(row, 'type').toLowerCase()
    const type = ['task', 'milestone', 'group'].includes(typeText) ? typeText : 'task'
    if (typeText !== '' && type !== typeText) warnings.push(`"${name}" has an unknown type "${typeText}", so it was made a task.`)

    let start = defaultStart
    const startText = cell(row, 'start')
    if (startText !== '') {
      const parsedStart = parseCsvDate(startText)
      if (parsedStart) start = parsedStart
      else badStarts += 1
    }

    let durationDays = type === 'milestone' ? 0 : 1
    const durationText = cell(row, 'duration')
    if (type !== 'milestone' && durationText !== '') {
      const parsedDuration = Number.parseFloat(durationText.replace(/[^\d.]/g, ''))
      if (Number.isFinite(parsedDuration) && parsedDuration >= 1) durationDays = Math.min(3650, Math.round(parsedDuration))
      else warnings.push(`"${name}" has a Duration that could not be used, so it was set to 1 day.`)
    }

    let percent = 0
    const percentText = cell(row, 'percent')
    if (percentText !== '') {
      const parsedPercent = Number.parseFloat(percentText.replace('%', ''))
      if (Number.isFinite(parsedPercent)) percent = Math.min(100, Math.max(0, Math.round(parsedPercent)))
    }

    const task = {
      id: generateId('t'),
      parentId,
      type,
      name,
      start,
      durationDays,
      percent,
      assignee: cell(row, 'assignee'),
      colour: parseColour(cell(row, 'colour')),
      notes: cell(row, 'notes').slice(0, 2000),
      collapsed: false,
      order: tasks.length,
      baseline: null,
    }
    tasks.push(task)

    const rowNumber = Number.parseInt(cell(row, 'row'), 10)
    const key = column.row !== undefined && Number.isInteger(rowNumber) ? rowNumber : tasks.length
    if (rowKeyToId.has(key)) warnings.push(`Row number ${key} is used more than once; predecessors will point to the first.`)
    else rowKeyToId.set(key, task.id)

    predecessorText.push(cell(row, 'predecessors'))
    stack.push({ level, id: task.id })
    previousLevel = level
  })

  if (tasks.length === 0) return fail('None of the rows had a task name, so there is nothing to import.')
  if (badStarts > 0) {
    warnings.push(`${badStarts} start ${badStarts === 1 ? 'date was' : 'dates were'} not understood and set to ${defaultStart}. Use YYYY-MM-DD or DD/MM/YYYY.`)
  }

  // A row with rows indented beneath it has to be a group.
  const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean))
  for (const task of tasks) {
    if (parentIds.has(task.id) && task.type !== 'group') {
      warnings.push(`"${task.name}" has tasks beneath it, so it became a group.`)
      task.type = 'group'
    }
  }

  const dependencies = []
  tasks.forEach((task, index) => {
    const text = predecessorText[index]
    if (text === '') return
    for (const part of text.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
      const parsed = parsePredecessor(part)
      if (!parsed) {
        warnings.push(`"${task.name}" has a predecessor "${part}" that was not understood, so it was ignored.`)
        continue
      }
      const fromId = rowKeyToId.get(parsed.row)
      if (!fromId) {
        warnings.push(`"${task.name}" depends on row ${parsed.row}, which does not exist, so it was ignored.`)
      } else if (fromId === task.id) {
        warnings.push(`"${task.name}" depends on itself, so that was ignored.`)
      } else {
        dependencies.push({ id: generateId('d'), from: fromId, to: task.id, type: parsed.type, lagDays: parsed.lagDays })
      }
    }
  })

  if (detectCycle(dependencies)) {
    return fail('The predecessors form a circular chain (for example A waits for B, and B waits for A). Fix the Predecessors column and try again.')
  }

  const shown = warnings.length > MAX_WARNINGS ? [...warnings.slice(0, MAX_WARNINGS), `...and ${warnings.length - MAX_WARNINGS} more.`] : warnings
  return { tasks, dependencies, warnings: shown, errors: [] }
}

/**
 * Schedules freshly imported tasks: moves their start dates off
 * non-working days, pushes successors to satisfy dependencies, and
 * rolls groups up from their children. Tasks that were already in the
 * project are left alone.
 * @param {{calendar: import('./calendar.js').WorkingCalendar, tasks: import('./scheduler.js').Task[], dependencies: import('./scheduler.js').Dependency[]}} project - the project including the imported tasks
 * @param {Set<string>} importedIds - the ids of the imported tasks
 * @returns {import('./scheduler.js').Task[]} the tasks after scheduling
 */
export function scheduleImported(project, importedIds) {
  const snapped = project.tasks.map((t) =>
    importedIds.has(t.id) && t.type !== 'group'
      ? { ...t, start: snapForwardToWorkingDay(t.start, project.calendar) }
      : t,
  )
  const afterDependencies = applyDependencies({ ...project, tasks: snapped }, [...importedIds])
  return rollUpGroups(afterDependencies.tasks, project.calendar)
}

/**
 * Builds a brand new project from a CSV file, for starting a chart
 * from a spreadsheet on the home page.
 * @param {string} text - the CSV text
 * @param {string} fileName - the file's name, used (without its extension) as the chart title
 * @param {string} defaultStart - the start date for rows that have none, `YYYY-MM-DD`
 * @returns {{project: object|null, warnings: string[], errors: string[]}} the new project, or null with the reasons it could not be built
 */
export function csvToNewProject(text, fileName, defaultStart) {
  const result = parseTasksCsv(text, { defaultStart })
  if (result.errors.length > 0) return { project: null, warnings: result.warnings, errors: result.errors }

  const title = fileName.replace(/\.[^.]*$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 120) || 'Imported tasks'
  const blank = createBlankProject(title)
  const draft = { ...blank, tasks: result.tasks, dependencies: result.dependencies }
  const tasks = scheduleImported(draft, new Set(result.tasks.map((t) => t.id)))
  return { project: { ...draft, tasks }, warnings: result.warnings, errors: [] }
}
