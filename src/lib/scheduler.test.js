import { describe, expect, it } from 'vitest'
import { DEFAULT_CALENDAR } from './calendar.js'
import {
  applyDependencies,
  computeEnd,
  criticalPath,
  detectCycle,
  removeDependenciesForTask,
  rollUpGroups,
} from './scheduler.js'

/**
 * Builds a minimal task record with sensible defaults, so each test
 * only has to spell out the fields it actually cares about.
 * @param {Partial<import('./scheduler.js').Task>} overrides - fields to override
 * @returns {import('./scheduler.js').Task} a task record
 */
function makeTask(overrides) {
  return {
    id: 't',
    parentId: null,
    type: 'task',
    name: 'Task',
    start: '2026-10-01',
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

describe('computeEnd', () => {
  it('ends a one day task on the same day it starts', () => {
    const task = makeTask({ start: '2026-10-01', durationDays: 1 })
    expect(computeEnd(task, DEFAULT_CALENDAR)).toBe('2026-10-01')
  })

  it('spans a weekend for a multi-day task', () => {
    // Thursday + 3 working days (Thu, Fri, Mon) ends on the Monday.
    const task = makeTask({ start: '2026-10-01', durationDays: 3 })
    expect(computeEnd(task, DEFAULT_CALENDAR)).toBe('2026-10-05')
  })

  it('treats a milestone as zero duration regardless of durationDays', () => {
    const task = makeTask({ type: 'milestone', start: '2026-10-01', durationDays: 0 })
    expect(computeEnd(task, DEFAULT_CALENDAR)).toBe('2026-10-01')
  })

  it('snaps a milestone starting on a non-working day forward', () => {
    const task = makeTask({ type: 'milestone', start: '2026-10-03', durationDays: 0 })
    expect(computeEnd(task, DEFAULT_CALENDAR)).toBe('2026-10-05')
  })

  it('snaps a task starting on a non-working day forward before applying duration', () => {
    const task = makeTask({ start: '2026-10-03', durationDays: 2 })
    // Snaps Saturday to Monday 10-05, then one more working day to Tuesday.
    expect(computeEnd(task, DEFAULT_CALENDAR)).toBe('2026-10-06')
  })
})

describe('applyDependencies', () => {
  it('pushes a Finish-to-Start successor to the day after its predecessor ends', () => {
    const pred = makeTask({ id: 'a', start: '2026-10-01', durationDays: 2 }) // ends Fri 10-02
    const succ = makeTask({ id: 'b', start: '2026-10-01', durationDays: 1 })
    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [pred, succ],
      dependencies: [{ id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 }],
    }

    const result = applyDependencies(project, ['a'])
    const updatedSucc = result.tasks.find((t) => t.id === 'b')
    expect(updatedSucc.start).toBe('2026-10-05')
    expect(result.changedTaskIds).toEqual(['b'])
  })

  it('applies positive lag as extra working days after a Finish-to-Start', () => {
    const pred = makeTask({ id: 'a', start: '2026-10-01', durationDays: 2 }) // ends Fri 10-02
    const succ = makeTask({ id: 'b', start: '2026-10-01', durationDays: 1 })
    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [pred, succ],
      dependencies: [{ id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 2 }],
    }

    const result = applyDependencies(project, ['a'])
    expect(result.tasks.find((t) => t.id === 'b').start).toBe('2026-10-07')
  })

  it('applies negative lag to allow a Finish-to-Start overlap', () => {
    const pred = makeTask({ id: 'a', start: '2026-10-01', durationDays: 2 }) // ends Fri 10-02
    const succ = makeTask({ id: 'b', start: '2026-10-01', durationDays: 1 })
    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [pred, succ],
      dependencies: [{ id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: -1 }],
    }

    const result = applyDependencies(project, ['a'])
    expect(result.tasks.find((t) => t.id === 'b').start).toBe('2026-10-02')
  })

  it('aligns a Start-to-Start successor with its predecessor plus lag', () => {
    const pred = makeTask({ id: 'a', start: '2026-10-01', durationDays: 5 })
    const succ = makeTask({ id: 'b', start: '2026-09-28', durationDays: 1 })
    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [pred, succ],
      dependencies: [{ id: 'd1', from: 'a', to: 'b', type: 'SS', lagDays: 1 }],
    }

    const result = applyDependencies(project, ['a'])
    expect(result.tasks.find((t) => t.id === 'b').start).toBe('2026-10-02')
  })

  it('aligns a Finish-to-Finish successor to end with its predecessor', () => {
    const pred = makeTask({ id: 'a', start: '2026-10-01', durationDays: 2 }) // ends Fri 10-02
    const succ = makeTask({ id: 'b', start: '2026-09-01', durationDays: 3 })
    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [pred, succ],
      dependencies: [{ id: 'd1', from: 'a', to: 'b', type: 'FF', lagDays: 0 }],
    }

    const result = applyDependencies(project, ['a'])
    const updatedSucc = result.tasks.find((t) => t.id === 'b')
    expect(updatedSucc.start).toBe('2026-09-30')
    expect(computeEnd(updatedSucc, DEFAULT_CALENDAR)).toBe('2026-10-02')
  })

  it('aligns a Start-to-Finish successor to end on or after the predecessor starts plus lag', () => {
    const pred = makeTask({ id: 'a', start: '2026-10-01', durationDays: 5 })
    const succ = makeTask({ id: 'b', start: '2026-09-01', durationDays: 2 })
    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [pred, succ],
      dependencies: [{ id: 'd1', from: 'a', to: 'b', type: 'SF', lagDays: 1 }],
    }

    const result = applyDependencies(project, ['a'])
    const updatedSucc = result.tasks.find((t) => t.id === 'b')
    expect(computeEnd(updatedSucc, DEFAULT_CALENDAR)).toBe('2026-10-02')
  })

  it('never pulls a successor earlier, only pushes it later', () => {
    const pred = makeTask({ id: 'a', start: '2026-10-01', durationDays: 1 })
    const succ = makeTask({ id: 'b', start: '2026-10-20', durationDays: 1 })
    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [pred, succ],
      dependencies: [{ id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 }],
    }

    const result = applyDependencies(project, ['a'])
    expect(result.tasks.find((t) => t.id === 'b').start).toBe('2026-10-20')
    expect(result.changedTaskIds).toEqual([])
  })

  it('cascades a push across a chain of successors', () => {
    const a = makeTask({ id: 'a', start: '2026-10-05', durationDays: 1 })
    const b = makeTask({ id: 'b', start: '2026-10-05', durationDays: 1 })
    const c = makeTask({ id: 'c', start: '2026-10-05', durationDays: 1 })
    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [a, b, c],
      dependencies: [
        { id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 },
        { id: 'd2', from: 'b', to: 'c', type: 'FS', lagDays: 0 },
      ],
    }

    const result = applyDependencies(project, ['a'])
    expect(result.tasks.find((t) => t.id === 'b').start).toBe('2026-10-06')
    expect(result.tasks.find((t) => t.id === 'c').start).toBe('2026-10-07')
  })

  it('reschedules FS, SS, FF and SF successors correctly across a weekend and a holiday block', () => {
    const calendar = {
      ...DEFAULT_CALENDAR,
      nonWorkingDates: ['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25'],
    }
    const pred = makeTask({ id: 'a', start: '2026-12-17', durationDays: 2 }) // Thu-Fri, ends 2026-12-18
    const make = (id) => makeTask({ id, start: '2026-12-01', durationDays: 3 })
    const project = {
      calendar,
      tasks: [pred, make('fs'), make('ss'), make('ff'), make('sf')],
      dependencies: [
        { id: 'd1', from: 'a', to: 'fs', type: 'FS', lagDays: 0 },
        { id: 'd2', from: 'a', to: 'ss', type: 'SS', lagDays: 2 },
        { id: 'd3', from: 'a', to: 'ff', type: 'FF', lagDays: 3 },
        { id: 'd4', from: 'a', to: 'sf', type: 'SF', lagDays: 3 },
      ],
    }

    const result = applyDependencies(project, ['a'])
    const get = (id) => result.tasks.find((t) => t.id === id)

    // FS: next working day after Fri 18th, past the weekend and the holiday week.
    expect(get('fs').start).toBe('2026-12-28')
    // SS: two working days after the 17th (18th, then 28th).
    expect(get('ss').start).toBe('2026-12-28')
    // FF: finishes three working days after the 18th (28th, 29th, 30th).
    expect(computeEnd(get('ff'), calendar)).toBe('2026-12-30')
    // SF: finishes three working days after the 17th (18th, 28th, 29th).
    expect(computeEnd(get('sf'), calendar)).toBe('2026-12-29')
  })

  it('moves a successor across a configured holiday block', () => {
    const calendar = {
      ...DEFAULT_CALENDAR,
      nonWorkingDates: ['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25'],
    }
    const pred = makeTask({ id: 'a', start: '2026-12-17', durationDays: 2 }) // Thu-Fri, ends 2026-12-18
    const succ = makeTask({ id: 'b', start: '2026-12-17', durationDays: 1 })
    const project = {
      calendar,
      tasks: [pred, succ],
      dependencies: [{ id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 }],
    }

    const result = applyDependencies(project, ['a'])
    expect(result.tasks.find((t) => t.id === 'b').start).toBe('2026-12-28')
  })
})

describe('detectCycle', () => {
  it('returns null when there is no cycle', () => {
    const dependencies = [
      { id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 },
      { id: 'd2', from: 'b', to: 'c', type: 'FS', lagDays: 0 },
    ]
    expect(detectCycle(dependencies)).toBeNull()
  })

  it('finds a direct cycle between two tasks', () => {
    const dependencies = [
      { id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 },
      { id: 'd2', from: 'b', to: 'a', type: 'FS', lagDays: 0 },
    ]
    const cycle = detectCycle(dependencies)
    expect(cycle).toContain('a')
    expect(cycle).toContain('b')
  })

  it('finds a cycle through three tasks', () => {
    const dependencies = [
      { id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 },
      { id: 'd2', from: 'b', to: 'c', type: 'FS', lagDays: 0 },
      { id: 'd3', from: 'c', to: 'a', type: 'FS', lagDays: 0 },
    ]
    const cycle = detectCycle(dependencies)
    expect(cycle).toEqual(expect.arrayContaining(['a', 'b', 'c']))
  })
})

describe('removeDependenciesForTask', () => {
  it('removes dependencies where the task is the predecessor or the successor', () => {
    const dependencies = [
      { id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 },
      { id: 'd2', from: 'c', to: 'a', type: 'FS', lagDays: 0 },
      { id: 'd3', from: 'b', to: 'c', type: 'FS', lagDays: 0 },
    ]
    const result = removeDependenciesForTask(dependencies, 'a')
    expect(result).toEqual([{ id: 'd3', from: 'b', to: 'c', type: 'FS', lagDays: 0 }])
  })
})

describe('rollUpGroups', () => {
  it('rolls up a simple group from its two children', () => {
    const group = makeTask({ id: 'g', type: 'group', start: '2000-01-01', durationDays: 1, percent: 0 })
    const t1 = makeTask({ id: 't1', parentId: 'g', start: '2026-10-01', durationDays: 2, percent: 100 }) // ends Fri 10-02
    const t2 = makeTask({ id: 't2', parentId: 'g', start: '2026-10-05', durationDays: 1, percent: 0 })

    const result = rollUpGroups([group, t1, t2], DEFAULT_CALENDAR)
    const updatedGroup = result.find((t) => t.id === 'g')

    expect(updatedGroup.start).toBe('2026-10-01')
    expect(updatedGroup.durationDays).toBe(3) // Thu, Fri, Mon
    expect(updatedGroup.percent).toBe(67) // (100*2 + 0*1) / 3, rounded
  })

  it('rolls up a group that contains another group', () => {
    const outer = makeTask({ id: 'outer', type: 'group', start: '2000-01-01', durationDays: 1, percent: 0 })
    const inner = makeTask({ id: 'inner', parentId: 'outer', type: 'group', start: '2000-01-01', durationDays: 1, percent: 0 })
    const leafA = makeTask({ id: 'a', parentId: 'inner', start: '2026-10-01', durationDays: 1, percent: 50 })
    const leafB = makeTask({ id: 'b', parentId: 'inner', start: '2026-10-02', durationDays: 1, percent: 50 })
    const leafC = makeTask({ id: 'c', parentId: 'outer', start: '2026-10-06', durationDays: 1, percent: 0 })

    const result = rollUpGroups([outer, inner, leafA, leafB, leafC], DEFAULT_CALENDAR)
    const updatedInner = result.find((t) => t.id === 'inner')
    const updatedOuter = result.find((t) => t.id === 'outer')

    expect(updatedInner.start).toBe('2026-10-01')
    expect(updatedInner.durationDays).toBe(2)
    expect(updatedInner.percent).toBe(50)

    expect(updatedOuter.start).toBe('2026-10-01')
    // Thu 10-01 through Tue 10-06 inclusive, skipping the weekend: 4 working days.
    expect(updatedOuter.durationDays).toBe(4)
  })

  it('leaves an empty group unchanged', () => {
    const group = makeTask({ id: 'g', type: 'group', start: '2026-10-01', durationDays: 3, percent: 40 })
    const result = rollUpGroups([group], DEFAULT_CALENDAR)
    expect(result[0]).toEqual(group)
  })
})

describe('criticalPath', () => {
  it('flags a tight chain as critical and a slack branch as not', () => {
    const a = makeTask({ id: 'a', start: '2026-10-01', durationDays: 1 })
    const b = makeTask({ id: 'b', start: '2026-10-01', durationDays: 1 })
    const c = makeTask({ id: 'c', start: '2026-10-01', durationDays: 1 })
    const d = makeTask({ id: 'd', start: '2026-10-01', durationDays: 1 })

    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [a, b, c, d],
      dependencies: [
        { id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 },
        { id: 'd2', from: 'b', to: 'c', type: 'FS', lagDays: 0 },
      ],
    }

    const scheduled = applyDependencies(project, ['a', 'b'])
    const result = criticalPath({ ...project, tasks: scheduled.tasks })

    expect(result.projectEnd).toBe('2026-10-05')
    expect(result.criticalTaskIds.sort()).toEqual(['a', 'b', 'c'])
    expect(result.criticalTaskIds).not.toContain('d')
    expect(result.floatByTaskId.d).toBeGreaterThan(0)
    expect(result.floatByTaskId.a).toBe(0)
  })

  it('returns an empty result for a project with no tasks', () => {
    const result = criticalPath({ calendar: DEFAULT_CALENDAR, tasks: [], dependencies: [] })
    expect(result).toEqual({ criticalTaskIds: [], projectEnd: null, floatByTaskId: {} })
  })
})
