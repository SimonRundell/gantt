import { describe, expect, it } from 'vitest'
import { DEFAULT_CALENDAR } from './calendar.js'
import { parseCsvDate, parsePredecessor, parseTasksCsv, scheduleImported, tasksToCsv } from './csvTasks.js'

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
    durationDays: 2,
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

describe('parseCsvDate', () => {
  it('reads ISO and UK dates', () => {
    expect(parseCsvDate('2026-10-05')).toBe('2026-10-05')
    expect(parseCsvDate('5/10/2026')).toBe('2026-10-05')
    expect(parseCsvDate('05-10-26')).toBe('2026-10-05')
    expect(parseCsvDate('5.10.2026')).toBe('2026-10-05')
  })

  it('rejects things that are not dates', () => {
    expect(parseCsvDate('31/02/2026')).toBeNull()
    expect(parseCsvDate('next week')).toBeNull()
  })
})

describe('parsePredecessor', () => {
  it('reads a row with optional type and lag', () => {
    expect(parsePredecessor('3')).toEqual({ row: 3, type: 'FS', lagDays: 0 })
    expect(parsePredecessor('3ss+2')).toEqual({ row: 3, type: 'SS', lagDays: 2 })
    expect(parsePredecessor('5FF-1d')).toEqual({ row: 5, type: 'FF', lagDays: -1 })
    expect(parsePredecessor('4 SF + 3 days')).toEqual({ row: 4, type: 'SF', lagDays: 3 })
  })

  it('rejects nonsense', () => {
    expect(parsePredecessor('abc')).toBeNull()
    expect(parsePredecessor('3XX')).toBeNull()
  })
})

describe('tasksToCsv and parseTasksCsv', () => {
  const tasks = [
    task({ id: 'g', type: 'group', name: 'Phase 1', order: 0 }),
    task({ id: 'a', parentId: 'g', name: 'Plan, then "review"', durationDays: 3, percent: 40, assignee: 'Sam', colour: 'green', notes: 'Line one\nLine two', order: 1 }),
    task({ id: 'b', parentId: 'g', name: 'Build', start: '2026-10-08', order: 2 }),
    task({ id: 'm', type: 'milestone', name: 'Done', durationDays: 0, order: 3 }),
  ]
  const dependencies = [
    { id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 },
    { id: 'd2', from: 'b', to: 'm', type: 'SS', lagDays: 2 },
  ]

  it('writes headings, levels and predecessors by row number', () => {
    const lines = tasksToCsv({ tasks, dependencies }).split('\r\n')
    expect(lines[0]).toContain('Name')
    expect(lines).toHaveLength(5)
    expect(lines[2].startsWith('2,1,')).toBe(true) // row 2, level 1
    expect(lines[3].endsWith('2FS')).toBe(true)
    expect(lines[4].endsWith('3SS+2')).toBe(true)
  })

  it('round trips names, structure, dates, assignees, notes and dependencies', () => {
    const result = parseTasksCsv(tasksToCsv({ tasks, dependencies }), { defaultStart: START })
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.tasks.map((t) => t.name)).toEqual(['Phase 1', 'Plan, then "review"', 'Build', 'Done'])
    expect(result.tasks.map((t) => t.type)).toEqual(['group', 'task', 'task', 'milestone'])
    expect(result.tasks[1].parentId).toBe(result.tasks[0].id)
    expect(result.tasks[3].parentId).toBeNull()
    expect(result.tasks[1]).toMatchObject({ durationDays: 3, percent: 40, assignee: 'Sam', colour: 'green', notes: 'Line one\nLine two' })
    expect(result.tasks[2].start).toBe('2026-10-08')
    expect(result.tasks[3].durationDays).toBe(0)

    const [first, second] = result.dependencies
    expect(first).toMatchObject({ from: result.tasks[1].id, to: result.tasks[2].id, type: 'FS', lagDays: 0 })
    expect(second).toMatchObject({ from: result.tasks[2].id, to: result.tasks[3].id, type: 'SS', lagDays: 2 })
  })

  it('does not run risky text as a formula and gets it back unchanged', () => {
    const risky = [task({ id: 'x', name: '=HYPERLINK("http://example.com")', notes: '-1 day' })]
    const csv = tasksToCsv({ tasks: risky, dependencies: [] })
    expect(csv).toContain("'=HYPERLINK")
    const result = parseTasksCsv(csv, { defaultStart: START })
    expect(result.tasks[0].name).toBe('=HYPERLINK("http://example.com")')
    expect(result.tasks[0].notes).toBe('-1 day')
  })
})

describe('parseTasksCsv with hand written files', () => {
  it('accepts a simple file with friendly headings, UK dates and semicolons', () => {
    const csv = 'Task;Start date;Days;% complete;Resource\nDesign;06/10/2026;5 days;50%;Priya\nBuild;;3;;'
    const result = parseTasksCsv(csv, { defaultStart: START })
    expect(result.errors).toEqual([])
    expect(result.tasks[0]).toMatchObject({ name: 'Design', start: '2026-10-06', durationDays: 5, percent: 50, assignee: 'Priya' })
    expect(result.tasks[1]).toMatchObject({ name: 'Build', start: START, durationDays: 3, percent: 0 })
  })

  it('works out the hierarchy from Level and promotes a parent to a group', () => {
    const csv = 'Level,Name\n0,Parent\n1,Child\n2,Grandchild\n0,Next'
    const result = parseTasksCsv(csv, { defaultStart: START })
    const [parent, child, grandchild, next] = result.tasks
    expect(child.parentId).toBe(parent.id)
    expect(grandchild.parentId).toBe(child.id)
    expect(next.parentId).toBeNull()
    expect(parent.type).toBe('group')
    expect(child.type).toBe('group')
    expect(result.warnings.some((w) => /became a group/.test(w))).toBe(true)
  })

  it('refers to rows by position when there is no Row column', () => {
    const csv = 'Name,Predecessors\nA,\nB,1\nC,"1; 2SS+1"'
    const result = parseTasksCsv(csv, { defaultStart: START })
    expect(result.dependencies).toHaveLength(3)
  })

  it('warns about, and ignores, things it cannot use', () => {
    const csv = 'Name,Start,Duration,Type,Predecessors\nA,someday,x,thing,9\n,,,,\nB,,,,B'
    const result = parseTasksCsv(csv, { defaultStart: START })
    expect(result.errors).toEqual([])
    expect(result.tasks).toHaveLength(2)
    expect(result.dependencies).toEqual([])
    expect(result.warnings.length).toBeGreaterThanOrEqual(4)
  })

  it('stops with a plain message when there is no Name column, no rows, or a loop', () => {
    expect(parseTasksCsv('Start,Days\n2026-10-05,3', { defaultStart: START }).errors[0]).toMatch(/Name column/)
    expect(parseTasksCsv('Name\n', { defaultStart: START }).errors[0]).toMatch(/no tasks/)
    const loop = parseTasksCsv('Name,Predecessors\nA,2\nB,1', { defaultStart: START })
    expect(loop.errors[0]).toMatch(/circular/)
    expect(loop.tasks).toEqual([])
  })

  it('stops when there are too many rows', () => {
    const csv = `Name\n${Array.from({ length: 1001 }, (_, i) => `T${i}`).join('\n')}`
    expect(parseTasksCsv(csv, { defaultStart: START }).errors[0]).toMatch(/at most 1000/)
  })
})

describe('scheduleImported', () => {
  it('moves starts off weekends, pushes successors and leaves existing tasks alone', () => {
    const existing = task({ id: 'old', start: '2026-10-10' }) // a Saturday, deliberately left as is
    const a = task({ id: 'a', start: '2026-10-10', durationDays: 2 }) // Saturday, snaps to Monday 12th
    const b = task({ id: 'b', start: '2026-10-12', durationDays: 1 })
    const project = {
      calendar: DEFAULT_CALENDAR,
      tasks: [existing, a, b],
      dependencies: [{ id: 'd', from: 'a', to: 'b', type: 'FS', lagDays: 0 }],
    }
    const result = scheduleImported(project, new Set(['a', 'b']))
    const byId = Object.fromEntries(result.map((t) => [t.id, t]))
    expect(byId.old.start).toBe('2026-10-10')
    expect(byId.a.start).toBe('2026-10-12')
    expect(byId.b.start).toBe('2026-10-14')
  })
})
