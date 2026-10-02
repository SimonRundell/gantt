/**
 * Working calendar: which days of the week count as working days, plus
 * a list of specific non-working dates (holidays, college closures).
 * @module lib/calendar
 */

import { addCalendarDays, dayOfWeek } from './dates.js'

/**
 * @typedef {object} WorkingCalendar
 * @property {number[]} workingDays - day-of-week indices that are working days, 0 (Sun) to 6 (Sat)
 * @property {string[]} nonWorkingDates - specific ISO dates that are never working days
 * @property {number} weekStartsOn - first day of the display week, 0 (Sun) or 1 (Mon)
 */

/** @type {WorkingCalendar} the default calendar: Monday to Friday, no holidays */
export const DEFAULT_CALENDAR = {
  workingDays: [1, 2, 3, 4, 5],
  nonWorkingDates: [],
  weekStartsOn: 1,
}

/**
 * Checks whether a given date is a working day under the supplied calendar.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {WorkingCalendar} calendar - the working calendar to check against
 * @returns {boolean} true when the date is a working day
 */
export function isWorkingDay(iso, calendar) {
  if (calendar.nonWorkingDates.includes(iso)) {
    return false
  }
  return calendar.workingDays.includes(dayOfWeek(iso))
}

/**
 * Snaps a date forward to the next working day, or returns it unchanged
 * if it is already a working day.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {WorkingCalendar} calendar - the working calendar to check against
 * @returns {string} a working day on or after the given date
 */
export function snapForwardToWorkingDay(iso, calendar) {
  let cursor = iso
  let guard = 0
  while (!isWorkingDay(cursor, calendar) && guard < 3660) {
    cursor = addCalendarDays(cursor, 1)
    guard += 1
  }
  return cursor
}

/**
 * Finds the next working day strictly after the given date.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {WorkingCalendar} calendar - the working calendar to check against
 * @returns {string} the next working day after the given date
 */
export function nextWorkingDay(iso, calendar) {
  return snapForwardToWorkingDay(addCalendarDays(iso, 1), calendar)
}

/**
 * Finds the previous working day strictly before the given date.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {WorkingCalendar} calendar - the working calendar to check against
 * @returns {string} the previous working day before the given date
 */
export function previousWorkingDay(iso, calendar) {
  let cursor = addCalendarDays(iso, -1)
  let guard = 0
  while (!isWorkingDay(cursor, calendar) && guard < 3660) {
    cursor = addCalendarDays(cursor, -1)
    guard += 1
  }
  return cursor
}

/**
 * Moves a date forward or backward by a number of working days. A
 * positive count moves forward, a negative count moves backward, and
 * zero snaps forward to the nearest working day without moving
 * further. The starting date does not need to be a working day itself.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {number} n - number of working days to move, may be negative
 * @param {WorkingCalendar} calendar - the working calendar to check against
 * @returns {string} the resulting working day
 */
export function shiftByWorkingDays(iso, n, calendar) {
  let cursor = snapForwardToWorkingDay(iso, calendar)

  if (n > 0) {
    for (let i = 0; i < n; i++) {
      cursor = nextWorkingDay(cursor, calendar)
    }
  } else if (n < 0) {
    for (let i = 0; i < -n; i++) {
      cursor = previousWorkingDay(cursor, calendar)
    }
  }

  return cursor
}

/**
 * Counts the working days between two dates, inclusive of the later
 * date and exclusive of the earlier one (so the result lines up with
 * `shiftByWorkingDays`: `shiftByWorkingDays(a, workingDaysBetween(a, b, cal), cal) === snapped(b)`
 * when both dates already fall on working days).
 * @param {string} aISO - the earlier reference date, `YYYY-MM-DD`
 * @param {string} bISO - the later or earlier date to compare, `YYYY-MM-DD`
 * @param {WorkingCalendar} calendar - the working calendar to check against
 * @returns {number} working days from a to b, negative if b is before a
 */
export function workingDaysBetween(aISO, bISO, calendar) {
  if (aISO === bISO) return 0

  const forward = bISO > aISO
  let from = forward ? aISO : bISO
  const to = forward ? bISO : aISO
  let count = 0
  let guard = 0

  while (from !== to && guard < 36600) {
    from = addCalendarDays(from, 1)
    if (isWorkingDay(from, calendar)) count += 1
    guard += 1
  }

  return forward ? count : -count
}

/**
 * Hard-coded England bank holiday dates, since the brief asks for a
 * one-off convenience button with no external calls. Covers the
 * current year this was written for and the next one; extend the table
 * when a new year is needed.
 * @type {Record<number, string[]>}
 */
export const UK_BANK_HOLIDAYS = {
  2026: [
    '2026-01-01', // New Year's Day
    '2026-04-03', // Good Friday
    '2026-04-06', // Easter Monday
    '2026-05-04', // Early May bank holiday
    '2026-05-25', // Spring bank holiday
    '2026-08-31', // Summer bank holiday
    '2026-12-25', // Christmas Day
    '2026-12-28', // Boxing Day (substitute, 26th is a Saturday)
  ],
  2027: [
    '2027-01-01', // New Year's Day
    '2027-03-26', // Good Friday
    '2027-03-29', // Easter Monday
    '2027-05-03', // Early May bank holiday
    '2027-05-31', // Spring bank holiday
    '2027-08-30', // Summer bank holiday
    '2027-12-27', // Christmas Day (substitute, 25th is a Saturday)
    '2027-12-28', // Boxing Day (substitute, 26th is a Sunday)
  ],
}

/**
 * Looks up the hard-coded England bank holidays for a year.
 * @param {number} year - the calendar year to look up
 * @returns {string[]} the bank holiday dates for that year, or an empty list if not available
 */
export function ukBankHolidaysForYear(year) {
  return UK_BANK_HOLIDAYS[year] ?? []
}

/**
 * Finds the start of the display week nearest to a date. A date three
 * days or less into a week rounds back to that week's start; later
 * dates round forward to the next week's start.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {0|1} weekStartsOn - the first day of the display week, 0 (Sun) or 1 (Mon)
 * @returns {string} the date of the nearest week start
 */
export function nearestWeekStart(iso, weekStartsOn) {
  const daysIntoWeek = (dayOfWeek(iso) - weekStartsOn + 7) % 7
  return addCalendarDays(iso, daysIntoWeek <= 3 ? -daysIntoWeek : 7 - daysIntoWeek)
}
