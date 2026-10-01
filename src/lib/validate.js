/**
 * Validation for an uploaded or server-loaded project document: first
 * the structural shape against the JSON Schema, then the semantic
 * rules a schema can't express (dependencies point at real tasks,
 * parents exist, the dependency graph has no cycles).
 * @module lib/validate
 */

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import schema from '../../docs/gantt.schema.json'
import { detectCycle } from './scheduler.js'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const validateSchema = ajv.compile(schema)

/**
 * Turns one Ajv error into a plain English sentence where it reasonably
 * can, falling back to Ajv's own message otherwise.
 * @param {import('ajv').ErrorObject} error - the Ajv validation error
 * @returns {string} a human-readable description of the problem
 */
function describeSchemaError(error) {
  const path = error.instancePath || '(top level)'
  return `${path}: ${error.message}`
}

/**
 * Validates a project document's structure and content. Combines JSON
 * Schema validation (shape, types, enums) with checks a schema alone
 * cannot express, so an upload or a server response can be rejected
 * with a clear reason before it's trusted.
 * @param {unknown} doc - the candidate project document
 * @returns {{valid: boolean, problems: string[]}} whether it's valid, and a plain English list of problems
 */
export function validateProject(doc) {
  const problems = []

  if (typeof doc !== 'object' || doc === null) {
    return { valid: false, problems: ['This file is not a Gantt chart project.'] }
  }

  const schemaOk = validateSchema(doc)
  if (!schemaOk) {
    for (const error of validateSchema.errors ?? []) {
      problems.push(describeSchemaError(error))
    }
    // Further semantic checks assume the basic shape is already sound,
    // so stop here rather than piling on confusing secondary errors.
    return { valid: false, problems }
  }

  const taskIds = new Set(doc.tasks.map((t) => t.id))
  const seen = new Set()
  for (const task of doc.tasks) {
    if (seen.has(task.id)) {
      problems.push(`Two tasks share the id '${task.id}'.`)
    }
    seen.add(task.id)

    if (task.parentId !== null && !taskIds.has(task.parentId)) {
      problems.push(`Task '${task.name}' has a parent that does not exist.`)
    }
  }

  for (const dep of doc.dependencies) {
    if (!taskIds.has(dep.from) || !taskIds.has(dep.to)) {
      const fromTask = doc.tasks.find((t) => t.id === dep.from)
      const toTask = doc.tasks.find((t) => t.id === dep.to)
      const fromName = fromTask?.name ?? dep.from
      const toName = toTask?.name ?? dep.to
      problems.push(`Task '${toName}' depends on '${fromName}', but that task does not exist.`)
    }
  }

  const cycle = detectCycle(doc.dependencies)
  if (cycle) {
    const names = cycle.map((id) => doc.tasks.find((t) => t.id === id)?.name ?? id)
    problems.push(`These tasks depend on each other in a loop: ${names.join(' -> ')}.`)
  }

  return { valid: problems.length === 0, problems }
}

/** @type {string[]} the only top-level keys a project document is allowed to carry */
const KNOWN_TOP_LEVEL_KEYS = [
  'schemaVersion',
  'id',
  'title',
  'createdAt',
  'updatedAt',
  'revision',
  'calendar',
  'view',
  'tasks',
  'dependencies',
]

/**
 * Strips anything that should never come from an untrusted upload: the
 * edit token hash (server-only, never meant for the client) and any
 * top-level key this app doesn't recognise.
 * @param {object} doc - a project document, already schema-valid
 * @returns {object} a copy of the document with unknown and sensitive keys removed
 */
export function sanitizeForImport(doc) {
  const clean = {}
  for (const key of KNOWN_TOP_LEVEL_KEYS) {
    if (key in doc) clean[key] = doc[key]
  }
  return clean
}
