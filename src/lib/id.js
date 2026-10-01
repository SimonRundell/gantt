/**
 * Short random id generation for client-side records (tasks and
 * dependencies). Project ids and edit tokens are generated server-side
 * with `random_bytes`; this is only for things created in the browser
 * before they are ever saved.
 * @module lib/id
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Generates a short random id with the given prefix, for example
 * `t_4f9k2a` for a task or `d_7h1m3q` for a dependency.
 * @param {string} prefix - a short label for what kind of record this is
 * @returns {string} the generated id
 */
export function generateId(prefix) {
  let suffix = ''
  for (let i = 0; i < 8; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return `${prefix}_${suffix}`
}
