/**
 * Maps project dates onto pixel positions along the timeline, and
 * defines the fixed zoom levels the editor offers.
 * @module lib/timelineScale
 */

import { addCalendarDays, calendarDaysBetween, dayOfWeek, formatUKDate, minISODate, maxISODate, todayISO } from './dates.js'
import { computeEnd } from './scheduler.js'

/**
 * @typedef {'day'|'week'|'month'|'quarter'} ZoomLevel
 */

/** @type {Record<ZoomLevel, {pxPerDay: number, label: string}>} the fixed zoom levels, pixels per calendar day */
export const ZOOM_LEVELS = {
  day: { pxPerDay: 36, label: 'Day' },
  week: { pxPerDay: 12, label: 'Week' },
  month: { pxPerDay: 4, label: 'Month' },
  quarter: { pxPerDay: 1.4, label: 'Quarter' },
}

/** @type {number} days of empty space kept either side of the project's own dates */
const RANGE_PADDING_DAYS = 14

/**
 * Looks up how many pixels one calendar day takes up at a zoom level.
 * @param {ZoomLevel} zoom - the current zoom level
 * @returns {number} pixels per calendar day
 */
export function pxPerDayFor(zoom) {
  return (ZOOM_LEVELS[zoom] ?? ZOOM_LEVELS.week).pxPerDay
}

/**
 * Works out the visible date range for the timeline: from a little
 * before the earliest task start (or today, if there are no tasks)
 * to a little after the latest task end.
 * @param {import('./scheduler.js').Task[]} tasks - every task in the project
 * @param {import('./calendar.js').WorkingCalendar} calendar - the project's working calendar
 * @returns {{startISO: string, endISO: string, totalDays: number}} the timeline's date range
 */
export function computeDateRange(tasks, calendar) {
  const today = todayISO()

  if (tasks.length === 0) {
    const startISO = addCalendarDays(today, -RANGE_PADDING_DAYS)
    const endISO = addCalendarDays(today, RANGE_PADDING_DAYS * 3)
    return { startISO, endISO, totalDays: calendarDaysBetween(startISO, endISO) }
  }

  let earliest = tasks[0].start
  let latest = computeEnd(tasks[0], calendar)

  for (const task of tasks) {
    earliest = minISODate(earliest, task.start)
    latest = maxISODate(latest, computeEnd(task, calendar))
  }

  earliest = minISODate(earliest, today)
  latest = maxISODate(latest, today)

  const startISO = addCalendarDays(earliest, -RANGE_PADDING_DAYS)
  const endISO = addCalendarDays(latest, RANGE_PADDING_DAYS)
  return { startISO, endISO, totalDays: calendarDaysBetween(startISO, endISO) }
}

/**
 * Converts a date into an x pixel offset from the start of the
 * timeline's date range.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {string} rangeStartISO - the timeline's range start date
 * @param {number} pxPerDay - pixels per calendar day at the current zoom
 * @returns {number} the x offset in pixels
 */
export function dateToX(iso, rangeStartISO, pxPerDay) {
  return calendarDaysBetween(rangeStartISO, iso) * pxPerDay
}

/**
 * Converts an x pixel offset back into a date, snapped to the
 * nearest whole day.
 * @param {number} x - the x offset in pixels from the range start
 * @param {string} rangeStartISO - the timeline's range start date
 * @param {number} pxPerDay - pixels per calendar day at the current zoom
 * @returns {string} the resulting `YYYY-MM-DD` date
 */
export function xToDate(x, rangeStartISO, pxPerDay) {
  const days = Math.round(x / pxPerDay)
  return addCalendarDays(rangeStartISO, days)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Finds the start of the week containing a date.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {number} weekStartsOn - 0 (Sunday) or 1 (Monday)
 * @returns {string} the ISO date of that week's first day
 */
function startOfWeek(iso, weekStartsOn) {
  const diff = (dayOfWeek(iso) - weekStartsOn + 7) % 7
  return addCalendarDays(iso, -diff)
}

/**
 * Finds the first day of the month containing a date.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @returns {string} the first of that month, `YYYY-MM-01`
 */
function startOfMonth(iso) {
  return `${iso.slice(0, 7)}-01`
}

/**
 * Finds the first day of the quarter containing a date.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @returns {string} the first day of that quarter
 */
function startOfQuarter(iso) {
  const [year, month] = iso.split('-').map(Number)
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1
  return `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`
}

/**
 * Adds a number of whole months to a date, landing on the first of
 * the resulting month.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {number} n - how many months to add
 * @returns {string} the first day of the resulting month
 */
function addMonths(iso, n) {
  const [year, month] = iso.split('-').map(Number)
  const total = year * 12 + (month - 1) + n
  const nextYear = Math.floor(total / 12)
  const nextMonth = (total % 12) + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

/**
 * Builds the two header tiers (a coarse row above a fine row) for the
 * timeline at a given zoom level, as a list of ticks each with an x
 * offset, a pixel width and a label.
 * @param {ZoomLevel} zoom - the current zoom level
 * @param {string} startISO - the timeline's range start date
 * @param {string} endISO - the timeline's range end date
 * @param {number} weekStartsOn - 0 (Sunday) or 1 (Monday)
 * @returns {{minorTicks: {x: number, width: number, label: string}[], majorTicks: {x: number, width: number, label: string}[]}} the two header tiers
 */
export function buildHeaderTiers(zoom, startISO, endISO, weekStartsOn) {
  const pxPerDay = pxPerDayFor(zoom)
  const minorTicks = []
  const majorTicks = []

  /** Pixel width of the span between two ISO dates. */
  const tickWidth = (fromISO, toISO) => calendarDaysBetween(fromISO, toISO) * pxPerDay
  /** Pixel x position of an ISO date on the timeline. */
  const x = (iso) => dateToX(iso, startISO, pxPerDay)

  if (zoom === 'day' || zoom === 'week') {
    const unitDays = zoom === 'day' ? 1 : 7
    let cursor = zoom === 'day' ? startISO : startOfWeek(startISO, weekStartsOn)

    while (cursor < endISO) {
      const next = addCalendarDays(cursor, unitDays)
      minorTicks.push({
        x: x(cursor),
        width: tickWidth(cursor, next),
        label: zoom === 'day' ? String(Number(cursor.slice(8, 10))) : formatUKDate(cursor),
      })
      cursor = next
    }

    let monthCursor = startOfMonth(startISO)
    while (monthCursor < endISO) {
      const next = addMonths(monthCursor, 1)
      const [year, month] = monthCursor.split('-').map(Number)
      majorTicks.push({
        x: x(monthCursor),
        width: tickWidth(monthCursor, next),
        label: `${MONTH_NAMES[month - 1]} ${year}`,
      })
      monthCursor = next
    }
  } else if (zoom === 'month') {
    let cursor = startOfMonth(startISO)
    while (cursor < endISO) {
      const next = addMonths(cursor, 1)
      const month = Number(cursor.slice(5, 7))
      minorTicks.push({ x: x(cursor), width: tickWidth(cursor, next), label: MONTH_NAMES[month - 1].slice(0, 3) })
      cursor = next
    }

    let yearCursor = `${startISO.slice(0, 4)}-01-01`
    while (yearCursor < endISO) {
      const next = `${Number(yearCursor.slice(0, 4)) + 1}-01-01`
      majorTicks.push({ x: x(yearCursor), width: tickWidth(yearCursor, next), label: yearCursor.slice(0, 4) })
      yearCursor = next
    }
  } else {
    let cursor = startOfQuarter(startISO)
    while (cursor < endISO) {
      const next = addMonths(cursor, 3)
      const quarter = Math.floor(Number(cursor.slice(5, 7)) / 3) + 1
      minorTicks.push({ x: x(cursor), width: tickWidth(cursor, next), label: `Q${quarter}` })
      cursor = next
    }

    let yearCursor = `${startISO.slice(0, 4)}-01-01`
    while (yearCursor < endISO) {
      const next = `${Number(yearCursor.slice(0, 4)) + 1}-01-01`
      majorTicks.push({ x: x(yearCursor), width: tickWidth(yearCursor, next), label: yearCursor.slice(0, 4) })
      yearCursor = next
    }
  }

  return { minorTicks, majorTicks }
}
