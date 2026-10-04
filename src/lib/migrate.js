/**
 * Upgrades older project documents to the schema version this build
 * of the app understands. Currently there is only one schema version,
 * so this is mostly a placeholder for future migrations, but every
 * uploaded or server-loaded file still passes through it.
 * @module lib/migrate
 */

/** @type {number} the schema version this build of the app writes and expects */
export const CURRENT_SCHEMA_VERSION = 2

/**
 * Migration steps, keyed by the version they upgrade *from*. Add a new
 * entry here (and bump CURRENT_SCHEMA_VERSION) whenever the document
 * shape changes in a way old files need help with.
 * @type {Record<number, (doc: object) => object>}
 */
const migrations = {
  // v1 -> v2: every task gets a comments list (append-only, added in
  // the task details panel). A file from before this existed simply
  // has none yet.
  1: (doc) => ({
    ...doc,
    schemaVersion: 2,
    tasks: doc.tasks.map((task) => (task.comments ? task : { ...task, comments: [] })),
  }),
}

/**
 * Brings a project document up to the current schema version.
 * @param {object} doc - the candidate project document, any supported schema version
 * @returns {{ok: true, doc: object}|{ok: false, error: string}} the migrated document, or why it could not be migrated
 */
export function migrate(doc) {
  if (typeof doc !== 'object' || doc === null || typeof doc.schemaVersion !== 'number') {
    return { ok: false, error: 'This file has no schema version, so it cannot be opened.' }
  }

  if (doc.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'This file was saved by a newer version of the app than this one understands. Try opening it in a newer version.',
    }
  }

  let working = doc
  let version = doc.schemaVersion

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations[version]
    if (!step) {
      return { ok: false, error: `This app does not know how to update a file from schema version ${version}.` }
    }
    working = step(working)
    version = working.schemaVersion
  }

  return { ok: true, doc: working }
}
