/**
 * Converts a project's tasks to and from Microsoft Project's XML
 * interchange format (MSPDI), so a chart can be opened in Microsoft
 * Project (or another tool that reads it) and a plan built there can
 * be brought in here.
 *
 * Only the fields this app itself understands make the trip: task
 * hierarchy, dates, duration, percent complete, milestone/summary
 * flags and predecessors with lag. Resources, assignments, baselines
 * and custom calendars are not read or written - a file that has them
 * still imports, it just leaves those parts behind; export never
 * includes them, so re-importing an exported file does not round-trip
 * anything beyond what is listed above.
 * @module lib/mspdi
 */

import { isValidISODate } from './dates.js'
import { generateId } from './id.js'
import { outlineOrder, scheduleImported } from './csvTasks.js'
import { computeEnd, detectCycle } from './scheduler.js'
import { createBlankProject } from './sampleProject.js'
import { buildChildrenMap } from './taskTree.js'

/** @type {number} the most tasks one import may add, matching the CSV importer's limit */
export const MAX_IMPORT_TASKS = 1000

/** @type {number} how many warnings are listed before the rest are summarised */
const MAX_WARNINGS = 15

/** @type {number} working hours in one day - Microsoft Project's own default, used to turn our whole-day durations into the hours MSPDI expects and back */
const HOURS_PER_DAY = 8

/** @type {Record<string, number>} our dependency type to MSPDI's PredecessorLink Type enum */
const DEP_TYPE_TO_MSPDI = { FF: 0, FS: 1, SF: 2, SS: 3 }

/** @type {Record<number, string>} the reverse of DEP_TYPE_TO_MSPDI, for import */
const MSPDI_TYPE_TO_DEP = { 0: 'FF', 1: 'FS', 2: 'SF', 3: 'SS' }

/**
 * Escapes text for safe use inside XML element content.
 * @param {string} value - the raw text
 * @returns {string} the text with XML's five special characters escaped
 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * The earliest start and latest computed end across every task, for
 * the document's own StartDate/FinishDate.
 * @param {{tasks: import('./scheduler.js').Task[], calendar: import('./calendar.js').WorkingCalendar}} project - the project to measure
 * @returns {{startISO: string, endISO: string}} the project's overall span, today on both ends if it has no tasks
 */
function projectDateRange(project) {
  if (project.tasks.length === 0) {
    const today = new Date().toISOString().slice(0, 10)
    return { startISO: today, endISO: today }
  }
  let startISO = project.tasks[0].start
  let endISO = computeEnd(project.tasks[0], project.calendar)
  for (const task of project.tasks) {
    if (task.start < startISO) startISO = task.start
    const end = computeEnd(task, project.calendar)
    if (end > endISO) endISO = end
  }
  return { startISO, endISO }
}

/**
 * Writes a project's tasks as a Microsoft Project XML (MSPDI) document.
 * @param {{title: string, calendar: import('./calendar.js').WorkingCalendar, tasks: import('./scheduler.js').Task[], dependencies: import('./scheduler.js').Dependency[]}} project - the project to export
 * @returns {string} the XML document text
 */
export function tasksToMspdiXml(project) {
  const outline = outlineOrder(project.tasks)
  const uidByTaskId = new Map(outline.map(({ task }, index) => [task.id, index + 1]))
  const childrenMap = buildChildrenMap(project.tasks)
  const { startISO, endISO } = projectDateRange(project)

  const taskXml = outline
    .map(({ task, depth }) => {
      const uid = uidByTaskId.get(task.id)
      const isSummary = (childrenMap.get(task.id) ?? []).length > 0
      const isMilestone = task.type === 'milestone'
      const durationHours = (isMilestone ? 0 : task.durationDays) * HOURS_PER_DAY
      const end = computeEnd(task, project.calendar)

      const predecessorXml = project.dependencies
        .filter((dep) => dep.to === task.id && uidByTaskId.has(dep.from))
        .map((dep) =>
          [
            '      <PredecessorLink>',
            `        <PredecessorUID>${uidByTaskId.get(dep.from)}</PredecessorUID>`,
            `        <Type>${DEP_TYPE_TO_MSPDI[dep.type]}</Type>`,
            '        <CrossProject>0</CrossProject>',
            `        <LinkLag>${Math.round((dep.lagDays ?? 0) * 10)}</LinkLag>`,
            '        <LagFormat>7</LagFormat>',
            '      </PredecessorLink>',
          ].join('\n'),
        )
        .join('\n')

      return [
        '    <Task>',
        `      <UID>${uid}</UID>`,
        `      <ID>${uid}</ID>`,
        `      <Name>${escapeXml(task.name)}</Name>`,
        '      <Type>1</Type>',
        '      <IsNull>0</IsNull>',
        `      <OutlineLevel>${depth + 1}</OutlineLevel>`,
        `      <Start>${task.start}T08:00:00</Start>`,
        `      <Finish>${end}T17:00:00</Finish>`,
        `      <Duration>PT${durationHours}H0M0S</Duration>`,
        '      <DurationFormat>7</DurationFormat>',
        `      <PercentComplete>${task.percent}</PercentComplete>`,
        `      <Milestone>${isMilestone ? 1 : 0}</Milestone>`,
        `      <Summary>${isSummary ? 1 : 0}</Summary>`,
        predecessorXml,
        '    </Task>',
      ]
        .filter((line) => line !== '')
        .join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Project xmlns="http://schemas.microsoft.com/project">',
    `  <Name>${escapeXml(project.title)}</Name>`,
    `  <Title>${escapeXml(project.title)}</Title>`,
    '  <ScheduleFromStart>1</ScheduleFromStart>',
    `  <StartDate>${startISO}T08:00:00</StartDate>`,
    `  <FinishDate>${endISO}T17:00:00</FinishDate>`,
    '  <DefaultStartTime>08:00:00</DefaultStartTime>',
    '  <DefaultFinishTime>17:00:00</DefaultFinishTime>',
    '  <MinutesPerDay>480</MinutesPerDay>',
    '  <DaysPerMonth>20</DaysPerMonth>',
    '  <Tasks>',
    taskXml,
    '  </Tasks>',
    '</Project>',
    '',
  ].join('\n')
}

/**
 * Reads the trimmed text of the first descendant element with a given
 * tag name. Safe to use for every field this importer reads, since
 * none of their names are reused inside a `PredecessorLink`.
 * @param {Element} el - the element to search within
 * @param {string} tagName - the child element's tag name
 * @returns {string} its trimmed text content, or an empty string if not found
 */
function childText(el, tagName) {
  const found = el.getElementsByTagName(tagName)[0]
  return found ? found.textContent.trim() : ''
}

/**
 * Reads an MSPDI `xs:duration` string such as `PT16H0M0S` into a
 * number of hours.
 * @param {string} value - the duration text
 * @returns {number|null} the duration in hours, or null if it could not be read
 */
function parseIsoDurationHours(value) {
  const match = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value.trim())
  if (!match || (!match[1] && !match[2] && !match[3])) return null
  return Number(match[1] ?? 0) + Number(match[2] ?? 0) / 60 + Number(match[3] ?? 0) / 3600
}

/**
 * @typedef {import('./csvTasks.js').CsvImportResult} MspdiImportResult
 */

/**
 * Reads a Microsoft Project XML (MSPDI) document into new tasks and
 * dependencies. As forgiving as the CSV importer: anything it cannot
 * use is reported as a warning rather than stopping the import,
 * apart from a file that will not parse as XML, has no tasks, or
 * whose predecessors form a loop.
 * @param {string} text - the XML document text
 * @param {object} options
 * @param {string} options.defaultStart - the start date for a task with no readable start, `YYYY-MM-DD`
 * @returns {MspdiImportResult} the parsed tasks, dependencies, warnings and errors
 */
export function parseMspdiXml(text, { defaultStart }) {
  const warnings = []
  const fail = (message) => ({ tasks: [], dependencies: [], warnings, errors: [message] })

  let doc
  try {
    doc = new DOMParser().parseFromString(text, 'application/xml')
  } catch {
    return fail('This file could not be read as XML.')
  }
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return fail('This file is not well-formed XML, so it could not be read.')
  }

  // UID 0 is the project summary task Microsoft Project adds when
  // "show project summary task" is on - it represents the whole
  // project, not a real task, so it is never imported.
  const taskEls = Array.from(doc.getElementsByTagName('Task')).filter((el) => childText(el, 'UID') !== '0')
  if (taskEls.length === 0) {
    return fail('No tasks were found in this file. It may not be a Microsoft Project XML export.')
  }
  if (taskEls.length > MAX_IMPORT_TASKS) {
    return fail(`The file has ${taskEls.length} tasks, but a chart can hold at most ${MAX_IMPORT_TASKS}.`)
  }

  const tasks = []
  const uidToId = new Map()
  const predecessorEls = []
  const stack = [] // the chain of ancestors of the task being read: {level, id}
  let previousLevel = -1
  let badStarts = 0

  taskEls.forEach((taskEl, index) => {
    const sourceRow = index + 1
    const name = childText(taskEl, 'Name').slice(0, 200)
    if (name === '') {
      warnings.push(`Task ${sourceRow} has no name, so it was skipped.`)
      return
    }

    let level = Number(childText(taskEl, 'OutlineLevel')) - 1
    if (!Number.isInteger(level) || level < 0) level = 0
    if (level > previousLevel + 1) level = previousLevel + 1
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop()
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : null

    const isMilestone = childText(taskEl, 'Milestone') === '1'

    let start = defaultStart
    const startText = childText(taskEl, 'Start').slice(0, 10)
    if (startText !== '') {
      if (isValidISODate(startText)) start = startText
      else badStarts += 1
    }

    let durationDays = isMilestone ? 0 : 1
    if (!isMilestone) {
      const durationText = childText(taskEl, 'Duration')
      const hours = durationText ? parseIsoDurationHours(durationText) : null
      if (hours !== null && hours >= 0) {
        durationDays = Math.max(1, Math.round(hours / HOURS_PER_DAY))
      } else if (durationText !== '') {
        warnings.push(`"${name}" has a duration that could not be used, so it was set to 1 day.`)
      }
    }

    let percent = 0
    const percentText = childText(taskEl, 'PercentComplete')
    if (percentText !== '') {
      const parsedPercent = Number(percentText)
      if (Number.isFinite(parsedPercent)) percent = Math.min(100, Math.max(0, Math.round(parsedPercent)))
    }

    const task = {
      id: generateId('t'),
      parentId,
      type: isMilestone ? 'milestone' : 'task',
      name,
      start,
      durationDays,
      percent,
      assignee: '',
      colour: 'blue',
      notes: '',
      collapsed: false,
      order: tasks.length,
      baseline: null,
      comments: [],
    }
    tasks.push(task)

    const uid = childText(taskEl, 'UID')
    if (uid !== '') uidToId.set(uid, task.id)

    predecessorEls.push(Array.from(taskEl.getElementsByTagName('PredecessorLink')))
    stack.push({ level, id: task.id })
    previousLevel = level
  })

  if (tasks.length === 0) return fail('None of the tasks had a name, so there is nothing to import.')
  if (badStarts > 0) {
    warnings.push(`${badStarts} start ${badStarts === 1 ? 'date was' : 'dates were'} not understood and set to ${defaultStart}.`)
  }

  // A task with tasks indented beneath it becomes a group, the same
  // rule the CSV importer uses. A milestone with children loses its
  // zero-duration flag instead, since a group's dates are always
  // worked out from its children.
  const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean))
  for (const task of tasks) {
    if (parentIds.has(task.id)) task.type = 'group'
  }

  const dependencies = []
  tasks.forEach((task, index) => {
    for (const predEl of predecessorEls[index]) {
      const fromId = uidToId.get(childText(predEl, 'PredecessorUID'))
      if (!fromId) {
        warnings.push(`"${task.name}" depends on a task that was not found, so it was ignored.`)
        continue
      }
      if (fromId === task.id) {
        warnings.push(`"${task.name}" depends on itself, so that was ignored.`)
        continue
      }
      const depType = MSPDI_TYPE_TO_DEP[Number(childText(predEl, 'Type'))] ?? 'FS'
      const lagTenths = Number(childText(predEl, 'LinkLag')) || 0
      dependencies.push({ id: generateId('d'), from: fromId, to: task.id, type: depType, lagDays: Math.round(lagTenths / 10) })
    }
  })

  if (detectCycle(dependencies)) {
    return fail('The predecessors form a circular chain (for example A waits for B, and B waits for A). This file could not be imported as it stands.')
  }

  const shown = warnings.length > MAX_WARNINGS ? [...warnings.slice(0, MAX_WARNINGS), `...and ${warnings.length - MAX_WARNINGS} more.`] : warnings
  return { tasks, dependencies, warnings: shown, errors: [] }
}

/**
 * Builds a brand new project from a Microsoft Project XML file, for
 * starting a chart from one on the home page.
 * @param {string} text - the XML document text
 * @param {string} fileName - the file's name, used (without its extension) as the chart title
 * @param {string} defaultStart - the start date for tasks that have none, `YYYY-MM-DD`
 * @returns {{project: object|null, warnings: string[], errors: string[]}} the new project, or null with the reasons it could not be built
 */
export function mspdiToNewProject(text, fileName, defaultStart) {
  const result = parseMspdiXml(text, { defaultStart })
  if (result.errors.length > 0) return { project: null, warnings: result.warnings, errors: result.errors }

  const title = fileName.replace(/\.[^.]*$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 120) || 'Imported tasks'
  const blank = createBlankProject(title)
  const draft = { ...blank, tasks: result.tasks, dependencies: result.dependencies }
  const tasks = scheduleImported(draft, new Set(result.tasks.map((t) => t.id)))
  return { project: { ...draft, tasks }, warnings: result.warnings, errors: [] }
}
