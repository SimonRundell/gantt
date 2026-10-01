/**
 * Shared layout constants. Kept in one place so the table rows and
 * the timeline bars always agree on how tall a row is.
 * @module lib/constants
 */

/** @type {number} the height of one task row in pixels */
export const ROW_HEIGHT = 32

/** @type {Record<string, string>} column id to its header label */
export const COLUMN_LABELS = {
  name: 'Name',
  start: 'Start',
  end: 'End',
  duration: 'Duration',
  percent: '%',
  assignee: 'Assignee',
  predecessors: 'Predecessors',
  notes: 'Notes',
}

/** @type {{label: string, value: string}[]} the eight named task colours offered in the editor */
export const TASK_COLOURS = [
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
  { value: 'teal', label: 'Teal' },
  { value: 'red', label: 'Red' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'grey', label: 'Grey' },
]
