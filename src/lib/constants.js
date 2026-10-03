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
  variance: 'Variance',
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

/**
 * Each task colour's hex value, kept in sync with the `--gc-*` custom
 * properties in `app.css`. The timeline's SVG shapes carry colour as
 * a CSS class (`task-bar__shape--blue` and so on) for the normal
 * editor and print views, but `html-to-image` (used for PNG/PDF
 * export) does not apply computed styles to SVG elements, so a
 * class-only colour is lost and falls back to solid black in the
 * rasterised image. These hex values are set directly as a `fill`/
 * `stroke` presentation attribute alongside the class, as a fallback
 * with no effect on screen or in print: a CSS class always outranks
 * a presentation attribute, so this only takes over when no
 * stylesheet is present to apply the class at all.
 * @type {Record<string, string>}
 */
export const TASK_COLOUR_HEX = {
  blue: '#2563eb',
  green: '#16a34a',
  orange: '#ea580c',
  purple: '#7c3aed',
  teal: '#0d9488',
  red: '#dc2626',
  yellow: '#a16207',
  grey: '#52525b',
}

/**
 * Other chart colours used as SVG presentation-attribute fallbacks
 * for the same reason as {@link TASK_COLOUR_HEX} - kept in sync with
 * the matching `--gc-*` custom properties in `app.css`.
 * @type {Record<string, string>}
 */
export const CHART_COLOURS = {
  nonWorking: '#eef2f8',
  gridLine: '#dbe2ee',
  today: '#dc2626',
  text: '#17223a',
  textMuted: '#55627a',
}
