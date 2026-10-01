import { describe, expect, it } from 'vitest'
import { sanitizeForImport, validateProject } from './validate.js'

/**
 * Builds a minimal, valid project document for a test to mutate.
 * @returns {object} a valid project document
 */
function makeProject() {
  return {
    schemaVersion: 1,
    id: 'k3F9xQ2mA7pL0dVw',
    title: 'Test project',
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-01T09:00:00Z',
    revision: 1,
    calendar: { workingDays: [1, 2, 3, 4, 5], nonWorkingDates: [], weekStartsOn: 1 },
    view: { zoom: 'week', showCriticalPath: false, showBaseline: false, columns: ['name', 'start'] },
    tasks: [
      {
        id: 't1',
        parentId: null,
        type: 'task',
        name: 'Write requirements',
        start: '2026-10-05',
        durationDays: 2,
        percent: 100,
        assignee: 'Sam',
        colour: 'green',
        notes: '',
        collapsed: false,
        order: 0,
        baseline: null,
      },
      {
        id: 't2',
        parentId: null,
        type: 'milestone',
        name: 'Requirements signed off',
        start: '2026-10-07',
        durationDays: 0,
        percent: 0,
        assignee: '',
        colour: 'orange',
        notes: '',
        collapsed: false,
        order: 1,
        baseline: null,
      },
    ],
    dependencies: [{ id: 'd1', from: 't1', to: 't2', type: 'FS', lagDays: 0 }],
  }
}

describe('validateProject', () => {
  it('accepts a well-formed project', () => {
    const result = validateProject(makeProject())
    expect(result.valid).toBe(true)
    expect(result.problems).toEqual([])
  })

  it('rejects something that is not an object', () => {
    const result = validateProject('not a project')
    expect(result.valid).toBe(false)
  })

  it('reports a dependency that points at a task that does not exist, by name', () => {
    const doc = makeProject()
    doc.dependencies.push({ id: 'd2', from: 't1', to: 'ghost', type: 'FS', lagDays: 0 })
    const result = validateProject(doc)
    expect(result.valid).toBe(false)
    expect(result.problems.some((p) => p.includes('does not exist'))).toBe(true)
  })

  it('reports a circular dependency in plain English', () => {
    const doc = makeProject()
    doc.dependencies.push({ id: 'd2', from: 't2', to: 't1', type: 'FS', lagDays: 0 })
    const result = validateProject(doc)
    expect(result.valid).toBe(false)
    expect(result.problems.some((p) => p.toLowerCase().includes('loop'))).toBe(true)
  })

  it('reports a task with a parent that does not exist', () => {
    const doc = makeProject()
    doc.tasks[0].parentId = 'no-such-group'
    const result = validateProject(doc)
    expect(result.valid).toBe(false)
    expect(result.problems.some((p) => p.includes('parent'))).toBe(true)
  })

  it('rejects an unrecognised task type via the schema', () => {
    const doc = makeProject()
    doc.tasks[0].type = 'phase'
    const result = validateProject(doc)
    expect(result.valid).toBe(false)
  })

  it('rejects a title that is too long', () => {
    const doc = makeProject()
    doc.title = 'x'.repeat(200)
    const result = validateProject(doc)
    expect(result.valid).toBe(false)
  })
})

describe('sanitizeForImport', () => {
  it('strips the edit token hash and unknown keys', () => {
    const doc = { ...makeProject(), editTokenHash: 'secret', somethingElse: 'nope' }
    const cleaned = sanitizeForImport(doc)
    expect(cleaned.editTokenHash).toBeUndefined()
    expect(cleaned.somethingElse).toBeUndefined()
    expect(cleaned.title).toBe('Test project')
  })
})
