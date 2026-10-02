/**
 * Pure helpers for editing a calendar's list of non-working dates in
 * the calendar dialog: expanding a date range, tidying a list, and
 * grouping consecutive days back into ranges for display.
 * @module lib/calendarEdit
 */

import { addCalendarDays, calendarDaysBetween, isValidISODate } from './dates.js'

/** @type {number} the longest range, in days, that can be added in one go */
export const MAX_RANGE_DAYS = 366

/**
 * @typedef {object} DateRange
 * @property {string} from - first date of the range, `YYYY-MM-DD`
 * @property {string} to - last date of the range, `YYYY-MM-DD`
 * @property {number} days - how many days the range covers
 */

/**
 * Lists every date from one date to another, inclusive.
 * @param {string} fromISO - first date, `YYYY-MM-DD`
 * @param {string} toISO - last date, `YYYY-MM-DD`
 * @returns {string[]} the dates in order, or an empty list if either date is invalid or the range is backwards or too long
 */
export function expandDateRange(fromISO, toISO) {
  if (!isValidISODate(fromISO) || !isValidISODate(toISO)) return []
  const span = calendarDaysBetween(fromISO, toISO)
  if (span < 0 || span + 1 > MAX_RANGE_DAYS) return []

  const dates = []
  for (let i = 0; i <= span; i++) dates.push(addCalendarDays(fromISO, i))
  return dates
}

/**
 * Merges new dates into an existing list, dropping duplicates and
 * invalid entries, and sorting the result.
 * @param {string[]} existing - the current non-working dates
 * @param {string[]} additions - dates to add
 * @returns {string[]} a new sorted list with no duplicates
 */
export function mergeDates(existing, additions) {
  const all = new Set([...existing, ...additions].filter((iso) => isValidISODate(iso)))
  return [...all].sort()
}

/**
 * Removes every date in an inclusive range from a list.
 * @param {string[]} dates - the current non-working dates
 * @param {string} fromISO - first date to remove
 * @param {string} toISO - last date to remove
 * @returns {string[]} the list without the dates in that range
 */
export function removeDateRange(dates, fromISO, toISO) {
  return dates.filter((iso) => iso < fromISO || iso > toISO)
}

/**
 * Groups a list of dates into runs of consecutive days, so a week-long
 * closure shows as one line rather than seven.
 * @param {string[]} dates - non-working dates, in any order
 * @returns {DateRange[]} the runs in date order
 */
export function groupIntoRanges(dates) {
  const sorted = mergeDates([], dates)
  const ranges = []

  for (const iso of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && addCalendarDays(last.to, 1) === iso) {
      last.to = iso
      last.days += 1
    } else {
      ranges.push({ from: iso, to: iso, days: 1 })
    }
  }

  return ranges
}
