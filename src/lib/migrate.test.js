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
})
