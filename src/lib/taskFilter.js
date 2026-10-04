/**
 * Filters the visible rows shown in the task table and timeline by
 * assignee and/or date range. Viewing only: this never changes what
 * is saved, printed or exported, only what is drawn on screen for
 * whoever has the filter set in their own browser.
 * @module lib/taskFilter
 */

import { computeEnd } from './scheduler.js'

/**
 * Lists every distinct assignee name used anywhere in the project,
 * for the "my tasks" dropdown, sorted alphabetically.
 * @param {import('./scheduler.js').Task[]} tasks - every task in the project
 * @returns {string[]} the distinct, non-empty assignee names
 */
export function distinctAssignees(tasks) {
  const names = new Set()
  for (const task of tasks) {
    const name = (task.assignee ?? '').trim()
    if (name !== '') names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/**
 * Whether a task falls on or between two dates (inclusive), treating
 * either bound as open when not given. Compares the task's whole
 * span (start to computed end), not just its start, so a long task
 * that merely overlaps the window still counts.
 * @param {import('./scheduler.js').Task} task - the task to test
 * @param {import('./calendar.js').WorkingCalendar} calendar - the project's working calendar, to compute the task's end
 * @param {string|null} fromISO - the window's start date, or null for no lower bound
 * @param {string|null} toISO - the window's end date, or null for no upper bound
 * @returns {boolean} whether the task's span overlaps the window
 */
function withinDateRange(task, calendar, fromISO, toISO) {
  if (fromISO && computeEnd(task, calendar) < fromISO) return false
  if (toISO && task.start > toISO) return false
  return true
}

/**
 * Filters an already-flattened row list down to the rows that match
 * the given assignee and/or date range, keeping every visible
 * ancestor of a match so the hierarchy still makes sense. A group
 * hidden behind a collapsed ancestor stays hidden regardless of the
 * filter: this only ever removes rows, it never reveals a row that
 * `flattenVisibleRows` had already hidden.
 * @param {{task: import('./scheduler.js').Task, depth: number, hasChildren: boolean}[]} rows - the rows to filter, from `flattenVisibleRows`
 * @param {import('./calendar.js').WorkingCalendar} calendar - the project's working calendar
 * @param {{assignee?: string|null, fromISO?: string|null, toISO?: string|null}} filters - the active filters; an unset or empty value means that filter is off
 * @returns {{task: import('./scheduler.js').Task, depth: number, hasChildren: boolean}[]} the matching rows, in their original order
 */
export function filterRows(rows, calendar, { assignee, fromISO, toISO } = {}) {
  if (!assignee && !fromISO && !toISO) return rows

  const rowByTaskId = new Map(rows.map((row) => [row.task.id, row]))
  const matches = (task) => {
    if (assignee && (task.assignee ?? '').trim() !== assignee) return false
    if ((fromISO || toISO) && !withinDateRange(task, calendar, fromISO || null, toISO || null)) return false
    return true
  }

  const keepIds = new Set()
  for (const row of rows) {
    if (!matches(row.task)) continue
    let current = row.task
    while (current && !keepIds.has(current.id)) {
      keepIds.add(current.id)
      current = current.parentId ? rowByTaskId.get(current.parentId)?.task : null
    }
  }

  return rows.filter((row) => keepIds.has(row.task.id))
}
