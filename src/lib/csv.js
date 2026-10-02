/**
 * A small, careful CSV reader and writer. Handles quoted cells, doubled
 * quotes, line breaks inside cells, a leading byte order mark, and the
 * comma, semicolon or tab separators that Excel produces in different
 * countries.
 * @module lib/csv
 */

/** @type {string[]} the separators tried when guessing, in order of preference */
const DELIMITERS = [',', ';', '\t']

/**
 * Guesses which separator a file uses by counting each candidate on
 * the first line, ignoring anything inside quotes.
 * @param {string} text - the CSV text
 * @returns {string} the most likely separator (a comma if none are found)
 */
export function detectDelimiter(text) {
  const counts = new Map(DELIMITERS.map((d) => [d, 0]))
  let inQuotes = false

  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes
    else if (!inQuotes && (char === '\n' || char === '\r')) break
    else if (!inQuotes && counts.has(char)) counts.set(char, counts.get(char) + 1)
  }

  let best = ','
  let bestCount = 0
  for (const [delimiter, count] of counts) {
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

/**
 * Reads CSV text into rows of cells.
 * @param {string} text - the CSV text
 * @returns {string[][]} one array of cell strings per row (completely empty rows are kept; callers decide what to do with them)
 */
export function parseCsv(text) {
  const source = text.replace(/^﻿/, '')
  const delimiter = detectDelimiter(source)
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

/**
 * Protects a cell from being run as a formula when the file is opened
 * in a spreadsheet: text that starts with =, +, - or @ (and is not just
 * a number) gets a leading apostrophe. `unprotectCell` reverses this.
 * @param {string} value - the cell text
 * @returns {string} the text, with a leading apostrophe added if it could be taken for a formula
 */
export function protectCell(value) {
  if (/^[=+\-@]/.test(value) && Number.isNaN(Number(value))) return `'${value}`
  return value
}

/**
 * Undoes `protectCell` when reading a file back in.
 * @param {string} value - the cell text from a file
 * @returns {string} the text without the protective apostrophe
 */
export function unprotectCell(value) {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value
}

/**
 * Turns rows of cells into CSV text, quoting cells that need it.
 * @param {string[][]} rows - the rows to write
 * @returns {string} CSV text with Windows style line endings (what Excel expects)
 */
export function stringifyCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? '')
          return /[",\r\n;\t]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    .join('\r\n')
}
