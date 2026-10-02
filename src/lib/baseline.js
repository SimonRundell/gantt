/**
 * Helpers for comparing the current plan with a saved baseline.
 * @module lib/baseline
 */

import { workingDaysBetween } from './calendar.js'
import { computeEnd } from './scheduler.js'
import { dateToX } from './timelineScale.js'

/**
 * Works out the end date of a task's baseline.
 * @param {import('./scheduler.js').Task} task - a task that has a baseline
 * @param {import('./calendar.js').WorkingCalendar} calendar - the working calendar
 * @returns {string|null} the baseline end date, `YYYY-MM-DD`, or null when there is no baseline
 */
export function baselineEnd(task, calendar) {
  if (!task.baseline) return null
  return computeEnd({ ...task, start: task.baseline.start, durationDays: task.baseline.durationDays }, calendar)
}

/**
 * How many working days later (positive) or earlier (negative) a task
 * now finishes compared with its baseline.
 * @param {import('./scheduler.js').Task} task - the task to compare
 * @param {import('./calendar.js').WorkingCalendar} calendar - the working calendar
 * @returns {number|null} the variance in working days, or null when the task has no baseline
 */
export function baselineVarianceDays(task, calendar) {
  const plannedEnd = baselineEnd(task, calendar)
  if (plannedEnd === null) return null
  return workingDaysBetween(plannedEnd, computeEnd(task, calendar), calendar)
}

/**
 * Formats a variance for display in the table.
 * @param {number|null} days - the variance from `baselineVarianceDays`
 * @returns {string} for example "+3d", "-1d", "0d", or an empty string when there is no baseline
 */
export function formatVariance(days) {
  if (days === null) return ''
  if (days > 0) return `+${days}d`
  return `${days}d`
}

/**
 * Works out where a task's baseline bar sits on the timeline.
 * @param {import('./scheduler.js').Task} task - a task that has a baseline
 * @param {import('./calendar.js').WorkingCalendar} calendar - the working calendar
 * @param {string} startISO - the date at the left edge of the timeline
 * @param {number} pxPerDay - pixels per calendar day
 * @returns {{x: number, width: number}} the left edge and width in pixels (width 0 for a milestone)
 */
export function baselineGeometry(task, calendar, startISO, pxPerDay) {
  const x = dateToX(task.baseline.start, startISO, pxPerDay)
  if (task.type === 'milestone') return { x, width: 0 }
  const endX = dateToX(baselineEnd(task, calendar), startISO, pxPerDay) + pxPerDay
  return { x, width: Math.max(endX - x, 4) }
}
