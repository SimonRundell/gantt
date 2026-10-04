import { describe, expect, it } from 'vitest'
import { DEFAULT_CALENDAR } from './calendar.js'
import { flattenVisibleRows } from './taskTree.js'
import { distinctAssignees, filterRows } from './taskFilter.js'

const START = '2026-10-05'

/**
 * Builds a task for the tests.
 * @param {object} overrides - fields to override
 * @returns {object} a task
 */
function task(overrides) {
  return {
    id: 't',
    parentId: null,
    type: 'task',
    name: 'Task',
    start: START,
    durationDays: 1,
    percent: 0,
    assignee: '',
    colour: 'blue',
    notes: '',
    collapsed: false,
    order: 0,
    baseline: null,
    ...overrides,
  }
}

describe('distinctAssignees', () => {
  it('lists each non-empty assignee once, sorted', () => {
    const tasks = [
      task({ id: '1', assignee: 'Priya' }),
      task({ id: '2', assignee: 'Sam' }),
      task({ id: '3', assignee: 'Priya' }),
      task({ id: '4', assignee: '' }),
      task({ id: '5', assignee: '  ' }),
    ]
    expect(distinctAssignees(tasks)).toEqual(['Priya', 'Sam'])
  })
})

describe('filterRows', () => {
  it('returns every row unchanged when no filter is active', () => {
    const tasks = [task({ id: '1' }), task({ id: '2' })]
    const rows = flattenVisibleRows(tasks)
    expect(filterRows(rows, DEFAULT_CALENDAR, {})).toBe(rows)
  })

  it('keeps only tasks assigned to the chosen name', () => {
    const tasks = [task({ id: '1', assignee: 'Sam' }), task({ id: '2', assignee: 'Priya' })]
    const rows = flattenVisibleRows(tasks)
    const filtered = filterRows(rows, DEFAULT_CALENDAR, { assignee: 'Sam' })
    expect(filtered.map((r) => r.task.id)).toEqual(['1'])
  })

  it('keeps a matching child and every one of its ancestors, but not an unrelated sibling branch', () => {
    const tasks = [
      task({ id: 'g1', type: 'group', name: 'Group one' }),
      task({ id: 'c1', parentId: 'g1', assignee: 'Sam' }),
      task({ id: 'g2', type: 'group', name: 'Group two' }),
      task({ id: 'c2', parentId: 'g2', assignee: 'Priya' }),
    ]
    const rows = flattenVisibleRows(tasks)
    const filtered = filterRows(rows, DEFAULT_CALENDAR, { assignee: 'Sam' })
    expect(filtered.map((r) => r.task.id)).toEqual(['g1', 'c1'])
  })

  it('keeps a task whose span overlaps the date window, and drops one that ends before it starts', () => {
    const tasks = [
      task({ id: 'early', start: '2026-10-01', durationDays: 2 }), // ends before the window
      task({ id: 'inside', start: '2026-10-10', durationDays: 2 }),
      task({ id: 'late', start: '2026-10-20', durationDays: 2 }), // starts after the window
    ]
    const rows = flattenVisibleRows(tasks)
    const filtered = filterRows(rows, DEFAULT_CALENDAR, { fromISO: '2026-10-08', toISO: '2026-10-15' })
    expect(filtered.map((r) => r.task.id)).toEqual(['inside'])
  })

  it('combines an assignee filter with a date range (a task must satisfy both)', () => {
    const tasks = [
      task({ id: 'match', assignee: 'Sam', start: '2026-10-10' }),
      task({ id: 'wrong-person', assignee: 'Priya', start: '2026-10-10' }),
      task({ id: 'wrong-date', assignee: 'Sam', start: '2026-11-01' }),
    ]
    const rows = flattenVisibleRows(tasks)
    const filtered = filterRows(rows, DEFAULT_CALENDAR, {
      assignee: 'Sam',
      fromISO: '2026-10-08',
      toISO: '2026-10-15',
    })
    expect(filtered.map((r) => r.task.id)).toEqual(['match'])
  })

  it('returns no rows when nothing matches', () => {
    const tasks = [task({ id: '1', assignee: 'Sam' })]
    const rows = flattenVisibleRows(tasks)
    expect(filterRows(rows, DEFAULT_CALENDAR, { assignee: 'Nobody' })).toEqual([])
  })

  it('never reveals a row already hidden by a collapsed ancestor', () => {
    const tasks = [
      task({ id: 'g1', type: 'group', name: 'Group one', collapsed: true }),
      task({ id: 'c1', parentId: 'g1', assignee: 'Sam' }),
    ]
    const rows = flattenVisibleRows(tasks)
    expect(rows.map((r) => r.task.id)).toEqual(['g1'])
    const filtered = filterRows(rows, DEFAULT_CALENDAR, { assignee: 'Sam' })
    expect(filtered).toEqual([])
  })
})
