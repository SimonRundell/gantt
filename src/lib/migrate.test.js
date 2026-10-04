import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, migrate } from './migrate.js'

describe('migrate', () => {
  it('passes a document already at the current version straight through', () => {
    const doc = { schemaVersion: CURRENT_SCHEMA_VERSION, title: 'Mine' }
    const result = migrate(doc)
    expect(result.ok).toBe(true)
    expect(result.doc).toBe(doc)
  })

  it('refuses a document from a newer schema version', () => {
    const doc = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, title: 'From the future' }
    const result = migrate(doc)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/newer/i)
  })

  it('refuses a document with no schema version at all', () => {
    const result = migrate({ title: 'No version' })
    expect(result.ok).toBe(false)
  })

  it('adds an empty comments list to every task from a version 1 file', () => {
    const doc = { schemaVersion: 1, title: 'Old file', tasks: [{ id: 't1', name: 'A task' }] }
    const result = migrate(doc)
    expect(result.ok).toBe(true)
    expect(result.doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.doc.tasks[0].comments).toEqual([])
  })

  it('leaves an existing comments list alone when migrating', () => {
    const existing = [{ id: 'c1', author: 'Sam', text: 'Hi', createdAt: '2026-01-01T00:00:00.000Z' }]
    const doc = { schemaVersion: 1, title: 'Old file', tasks: [{ id: 't1', name: 'A task', comments: existing }] }
    const result = migrate(doc)
    expect(result.doc.tasks[0].comments).toBe(existing)
  })
})
