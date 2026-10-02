import { describe, expect, it } from 'vitest'
import { DEFAULT_CALENDAR } from './calendar.js'
import { splitAssignees, summariseResources } from './resources.js'

/**
 * Builds a task for the tests.
 * @param {object} overrides - fields to override
 * @returns {object} a task
 */
function task(overrides) {
  return { id: 't', type: 'task', name: 'Task', start: '2026-10-05', durationDays: 2, percent: 0, assignee: '', ...overrides }
}

describe('splitAssignees', () => {
  it('splits on commas and trims', () => {
    expect(splitAssignees(' Sam , Alex,, ')).toEqual(['Sam', 'Alex'])
    expect(splitAssignees('')).toEqual([])
  })
})

describe('summariseResources', () => {
  it('counts tasks per person, ignoring case, and counts unassigned tasks', () => {
    const { people, unassignedCount } = summariseResources(
      [
        task({ id: 'a', assignee: 'Sam' }),
        task({ id: 'b', assignee: 'sam', start: '2026-10-12', percent: 100 }),
        task({ id: 'c', assignee: 'Alex' }),
        task({ id: 'd' }),
      ],
      DEFAULT_CALENDAR,
    )
    expect(people.map((p) => p.name)).toEqual(['Alex', 'Sam'])
    const sam = people.find((p) => p.name === 'Sam')
    expect(sam.tasks).toHaveLength(2)
    expect(sam.openCount).toBe(1)
    expect(unassignedCount).toBe(1)
  })

  it('flags overlapping tasks for the same person but not back to back ones', () => {
    const { people } = summariseResources(
      [
        task({ id: 'a', assignee: 'Sam', start: '2026-10-05', durationDays: 3 }), // Mon-Wed
        task({ id: 'b', assignee: 'Sam', start: '2026-10-07', durationDays: 2 }), // Wed-Thu overlaps a
        task({ id: 'c', assignee: 'Sam', start: '2026-10-08', durationDays: 1 }), // Thu overlaps b only
        task({ id: 'd', assignee: 'Sam', start: '2026-10-09', durationDays: 1 }), // Fri, no overlap
      ],
      DEFAULT_CALENDAR,
    )
    const pairs = people[0].overlaps.map(([x, y]) => `${x.id}${y.id}`)
    expect(pairs).toEqual(['ab', 'bc'])
  })

  it('skips groups and never counts milestones as overlapping', () => {
    const { people, unassignedCount } = summariseResources(
      [
        task({ id: 'g', type: 'group', assignee: 'Sam' }),
        task({ id: 'a', assignee: 'Sam', start: '2026-10-05', durationDays: 3 }),
        task({ id: 'm', type: 'milestone', assignee: 'Sam', start: '2026-10-06', durationDays: 0 }),
      ],
      DEFAULT_CALENDAR,
    )
    expect(people[0].tasks).toHaveLength(2)
    expect(people[0].overlaps).toEqual([])
    expect(unassignedCount).toBe(0)
  })

  it('gives a shared task to each person named', () => {
    const { people } = summariseResources([task({ assignee: 'Sam, Alex' })], DEFAULT_CALENDAR)
    expect(people.map((p) => p.name)).toEqual(['Alex', 'Sam'])
  })
})
