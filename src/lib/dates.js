/**
 * Calendar date helpers. Every project date is a plain `YYYY-MM-DD`
 * string with no time zone attached. All arithmetic here goes through
 * `Date.UTC`, so a date never silently shifts by a day because of the
 * browser's local time zone. The only place local time matters is
 * `todayISO`, which reads the user's wall-clock date on purpose.
 * @module lib/dates
 */

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Checks whether a string is a well-formed `YYYY-MM-DD` date and
 * represents a real calendar date (rejects things like 2026-02-30).
 * @param {string} iso - candidate date string
 * @returns {boolean} true when the string is a valid ISO calendar date
 */
export function isValidISODate(iso) {
  if (typeof iso !== 'string' || !ISO_PATTERN.test(iso)) {
    return false
  }

  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Parses an ISO date string into a UTC midnight Date object.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @returns {Date} the equivalent UTC midnight Date
 */
export function parseISODate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Formats a UTC midnight Date object back into an ISO date string.
 * @param {Date} date - a Date, read using its UTC fields
 * @returns {string} the equivalent `YYYY-MM-DD` string
 */
export function toISODate(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Adds a number of calendar days (not working days) to an ISO date.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @param {number} n - number of days to add, may be negative
 * @returns {string} the resulting `YYYY-MM-DD` string
 */
export function addCalendarDays(iso, n) {
  const date = parseISODate(iso)
  date.setUTCDate(date.getUTCDate() + n)
  return toISODate(date)
}

/**
 * Returns the day of the week for an ISO date, 0 (Sunday) to 6 (Saturday).
 * @param {string} iso - a `YYYY-MM-DD` string
 * @returns {number} the day of week index
 */
export function dayOfWeek(iso) {
  return parseISODate(iso).getUTCDay()
}

/**
 * Compares two ISO date strings chronologically.
 * @param {string} a - a `YYYY-MM-DD` string
 * @param {string} b - a `YYYY-MM-DD` string
 * @returns {number} negative when a < b, positive when a > b, zero when equal
 */
export function compareISODates(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Returns the smaller of two ISO dates.
 * @param {string} a - a `YYYY-MM-DD` string
 * @param {string} b - a `YYYY-MM-DD` string
 * @returns {string} whichever date is earlier
 */
export function minISODate(a, b) {
  return compareISODates(a, b) <= 0 ? a : b
}

/**
 * Returns the larger of two ISO dates.
 * @param {string} a - a `YYYY-MM-DD` string
 * @param {string} b - a `YYYY-MM-DD` string
 * @returns {string} whichever date is later
 */
export function maxISODate(a, b) {
  return compareISODates(a, b) >= 0 ? a : b
}

/**
 * Returns today's date in the user's local time zone as an ISO string.
 * Deliberately uses local date parts (not UTC) because "today" means
 * the day on the user's wall clock, not in UTC.
 * @returns {string} today's date as `YYYY-MM-DD`
 */
export function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats an ISO date for display in the UK style, `dd/mm/yyyy`.
 * @param {string} iso - a `YYYY-MM-DD` string
 * @returns {string} the date formatted as `dd/mm/yyyy`
 */
export function formatUKDate(iso) {
  if (!isValidISODate(iso)) return ''
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}
