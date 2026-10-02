/**
 * Turns raw text typed into a task field (in the table or the details
 * panel) into a safe change to a task, or nothing if it is not usable.
 * Keeping this in one place means every way of editing a task applies
 * the same limits.
 * @module lib/taskFields
 */

import { isValidISODate } from './dates.js'

/** @type {number} the longest a task may last, in working days */
export const MAX_DURATION_DAYS = 3650

/**
 * Parses what was typed for one editable task field.
 * @param {'start'|'durationDays'|'percent'} field - which field was edited
 * @param {string} raw - the text from the input
 * @returns {Record<string, string|number>|null} the fields to update (for example `{ percent: 40 }`), or null if the text should be ignored
 */
export function parseTaskField(field, raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return null

  if (field === 'start') {
    return isValidISODate(text) ? { start: text } : null
  }

  const number = Number(text)
  if (!Number.isFinite(number)) return null

  if (field === 'durationDays') {
    return { durationDays: Math.min(MAX_DURATION_DAYS, Math.max(1, Math.round(number))) }
  }

  if (field === 'percent') {
    return { percent: Math.min(100, Math.max(0, Math.round(number))) }
  }

  return null
}
