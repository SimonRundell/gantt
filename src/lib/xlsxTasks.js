/**
 * Writes a project's tasks to an Excel workbook, the same columns as
 * the CSV export but as a real spreadsheet: a bold header row, a
 * frozen top row, sensible column widths and the task hierarchy shown
 * with Excel's own cell indent rather than a Level column.
 * @module lib/xlsxTasks
 */

import ExcelJS from 'exceljs'
import { computeEnd } from './scheduler.js'
import { formatUKDate } from './dates.js'
import { outlineOrder, predecessorsRenderer } from './csvTasks.js'

/** @type {{header: string, key: string, width: number}[]} the columns written, in order */
const COLUMNS = [
  { header: 'Name', key: 'name', width: 40 },
  { header: 'Type', key: 'type', width: 12 },
  { header: 'Start', key: 'start', width: 12 },
  { header: 'End', key: 'end', width: 12 },
  { header: 'Duration (working days)', key: 'duration', width: 14 },
  { header: 'Percent complete', key: 'percent', width: 10 },
  { header: 'Assignee', key: 'assignee', width: 16 },
  { header: 'Colour', key: 'colour', width: 10 },
  { header: 'Notes', key: 'notes', width: 30 },
  { header: 'Predecessors', key: 'predecessors', width: 16 },
]

/**
 * Builds an Excel workbook for a project's tasks.
 * @param {{title: string, calendar: import('./calendar.js').WorkingCalendar, tasks: import('./scheduler.js').Task[], dependencies: import('./scheduler.js').Dependency[]}} project - the project to export
 * @returns {ExcelJS.Workbook} the workbook, ready to write to a buffer
 */
export function buildTasksWorkbook(project) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Gantt Chart Planner'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Tasks', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = COLUMNS

  const outline = outlineOrder(project.tasks)
  const rowById = new Map(outline.map(({ task }, index) => [task.id, index + 1]))
  const predecessorsFor = predecessorsRenderer(project, rowById)

  outline.forEach(({ task, depth }) => {
    const row = sheet.addRow({
      name: task.name,
      type: task.type,
      start: formatUKDate(task.start),
      end: formatUKDate(computeEnd(task, project.calendar)),
      duration: task.type === 'milestone' ? 0 : task.durationDays,
      percent: task.percent,
      assignee: task.assignee ?? '',
      colour: task.colour,
      notes: task.notes ?? '',
      predecessors: predecessorsFor(task.id),
    })
    row.getCell('name').alignment = { indent: depth }
    row.getCell('percent').numFmt = '0"%"'
  })

  sheet.getRow(1).font = { bold: true }

  return workbook
}

/**
 * Writes a project's tasks to an `.xlsx` file as an `ArrayBuffer`,
 * ready to wrap in a `Blob` and download.
 * @param {{title: string, calendar: import('./calendar.js').WorkingCalendar, tasks: import('./scheduler.js').Task[], dependencies: import('./scheduler.js').Dependency[]}} project - the project to export
 * @returns {Promise<ArrayBuffer>} the workbook's file contents
 */
export async function tasksToXlsxBuffer(project) {
  const workbook = buildTasksWorkbook(project)
  return workbook.xlsx.writeBuffer()
}
