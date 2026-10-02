import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../lib/sampleProject.js'
import { createInitialState, projectReducer } from './projectReducer.js'

/**
 * Builds a starting state with two tasks already in it, for tests
 * that need something to edit rather than an empty project.
 * @returns {object} an initial reducer state with two tasks
 */
function twoTaskState() {
  const project = createBlankProject('Test')
  project.tasks = [
    {
      id: 'a',
      parentId: null,
      type: 'task',
      name: 'Task A',
      start: '2026-10-05',
      durationDays: 1,
      percent: 0,
      assignee: '',
      colour: 'blue',
      notes: '',
      collapsed: false,
      order: 0,
      baseline: null,
    },
    {
      id: 'b',
      parentId: null,
      type: 'task',
      name: 'Task B',
      start: '2026-10-05',
      durationDays: 1,
      percent: 0,
      assignee: '',
      colour: 'green',
      notes: '',
      collapsed: false,
      order: 1,
      baseline: null,
    },
  ]
  return createInitialState(project)
}

describe('ADD_TASK', () => {
  it('adds a task and selects it', () => {
    const state = createInitialState(createBlankProject('Test'))
    const next = projectReducer(state, { type: 'ADD_TASK', taskType: 'task' })
    expect(next.project.tasks).toHaveLength(1)
    expect(next.selection.taskId).toBe(next.project.tasks[0].id)
    expect(next.history.past).toHaveLength(1)
  })
})

describe('DELETE_TASK', () => {
  it('removes a group and its children together', () => {
    const project = createBlankProject('Test')
    project.tasks = [
      { id: 'g', parentId: null, type: 'group', name: 'Group', start: '2026-10-05', durationDays: 1, percent: 0, assignee: '', colour: 'blue', notes: '', collapsed: false, order: 0, baseline: null },
      { id: 'c1', parentId: 'g', type: 'task', name: 'Child 1', start: '2026-10-05', durationDays: 1, percent: 0, assignee: '', colour: 'blue', notes: '', collapsed: false, order: 1, baseline: null },
      { id: 'c2', parentId: 'g', type: 'task', name: 'Child 2', start: '2026-10-05', durationDays: 1, percent: 0, assignee: '', colour: 'blue', notes: '', collapsed: false, order: 2, baseline: null },
    ]
    const state = createInitialState(project)

    const next = projectReducer(state, { type: 'DELETE_TASK', taskId: 'g' })
    expect(next.project.tasks).toHaveLength(0)
  })

  it('removes dependencies that touched the deleted task', () => {
    const state = twoTaskState()
    state.project.dependencies = [{ id: 'd1', from: 'a', to: 'b', type: 'FS', lagDays: 0 }]

    const next = projectReducer(state, { type: 'DELETE_TASK', taskId: 'a' })
    expect(next.project.dependencies).toEqual([])
    expect(next.project.tasks.map((t) => t.id)).toEqual(['b'])
  })

  it('clears the selection if the selected task was removed', () => {
    const state = { ...twoTaskState(), selection: { taskId: 'a' } }
    const next = projectReducer(state, { type: 'DELETE_TASK', taskId: 'a' })
    expect(next.selection.taskId).toBeNull()
  })
})

describe('INDENT_TASK and OUTDENT_TASK', () => {
  it('makes a task a child of its previous sibling', () => {
    const state = twoTaskState()
    const next = projectReducer(state, { type: 'INDENT_TASK', taskId: 'b' })
    expect(next.project.tasks.find((t) => t.id === 'b').parentId).toBe('a')
  })

  it('does nothing when there is no previous sibling to indent under', () => {
    const state = twoTaskState()
    const next = projectReducer(state, { type: 'INDENT_TASK', taskId: 'a' })
    expect(next).toBe(state)
  })

  it('outdents a child back to its grandparent level', () => {
    let state = twoTaskState()
    state = projectReducer(state, { type: 'INDENT_TASK', taskId: 'b' })
    const next = projectReducer(state, { type: 'OUTDENT_TASK', taskId: 'b' })
    expect(next.project.tasks.find((t) => t.id === 'b').parentId).toBeNull()
  })
})

describe('ADD_DEPENDENCY', () => {
  it('adds a valid dependency and reschedules the successor', () => {
    const state = twoTaskState()
    const next = projectReducer(state, { type: 'ADD_DEPENDENCY', from: 'a', to: 'b', depType: 'FS', lagDays: 0 })
    expect(next.project.dependencies).toHaveLength(1)
    // a ends 2026-10-05 (Monday), so b should be pushed to the Tuesday.
    expect(next.project.tasks.find((t) => t.id === 'b').start).toBe('2026-10-06')
  })

  it('refuses a dependency that would create a cycle and reports an error', () => {
    let state = twoTaskState()
    state = projectReducer(state, { type: 'ADD_DEPENDENCY', from: 'a', to: 'b', depType: 'FS', lagDays: 0 })
    const next = projectReducer(state, { type: 'ADD_DEPENDENCY', from: 'b', to: 'a', depType: 'FS', lagDays: 0 })
    expect(next.project.dependencies).toHaveLength(1)
    expect(next.ui.lastError).toMatch(/circular/i)
  })

  it('refuses a task depending on itself', () => {
    const state = twoTaskState()
    const next = projectReducer(state, { type: 'ADD_DEPENDENCY', from: 'a', to: 'a', depType: 'FS', lagDays: 0 })
    expect(next.project.dependencies).toHaveLength(0)
    expect(next.ui.lastError).toBeTruthy()
  })
})

describe('DUPLICATE_TASK', () => {
  it('copies a task directly after the original and selects the copy', () => {
    const state = twoTaskState()
    const next = projectReducer(state, { type: 'DUPLICATE_TASK', taskId: 'a' })
    const names = [...next.project.tasks].sort((x, y) => x.order - y.order).map((t) => t.name)
    expect(names).toEqual(['Task A', 'Task A (copy)', 'Task B'])
    const copy = next.project.tasks.find((t) => t.name === 'Task A (copy)')
    expect(copy.id).not.toBe('a')
    expect(next.selection.taskId).toBe(copy.id)
  })

  it('copies a group with its children and their internal dependencies', () => {
    let state = twoTaskState()
    state = projectReducer(state, { type: 'INDENT_TASK', taskId: 'b' }) // b becomes a child of a
    state = projectReducer(state, { type: 'ADD_TASK', afterTaskId: 'b', taskType: 'task' })
    const child2 = state.project.tasks.find((t) => t.name === 'New task')
    state = projectReducer(state, { type: 'ADD_DEPENDENCY', from: 'b', to: child2.id, depType: 'FS', lagDays: 0 })

    const next = projectReducer(state, { type: 'DUPLICATE_TASK', taskId: 'a' })
    expect(next.project.tasks).toHaveLength(state.project.tasks.length * 2)
    expect(next.project.dependencies).toHaveLength(2)
    const copyIds = new Set(next.project.tasks.filter((t) => !state.project.tasks.some((o) => o.id === t.id)).map((t) => t.id))
    const copiedDep = next.project.dependencies.find((d) => copyIds.has(d.from))
    expect(copyIds.has(copiedDep.to)).toBe(true)
  })
})

describe('baseline', () => {
  it('records every task date, shows the baseline, and can be cleared', () => {
    const state = twoTaskState()
    const set = projectReducer(state, { type: 'SET_BASELINE' })
    expect(set.project.tasks[0].baseline).toEqual({ start: '2026-10-05', durationDays: 1 })
    expect(set.project.view.showBaseline).toBe(true)

    const cleared = projectReducer(set, { type: 'CLEAR_BASELINE' })
    expect(cleared.project.tasks.every((t) => t.baseline === null)).toBe(true)
    expect(cleared.project.view.showBaseline).toBe(false)
  })
})

describe('SET_VIEW_OPTION', () => {
  it('sets a view option without adding an undo step', () => {
    const state = twoTaskState()
    const next = projectReducer(state, { type: 'SET_VIEW_OPTION', key: 'snap', value: 'week' })
    expect(next.project.view.snap).toBe('week')
    expect(next.history.past).toHaveLength(0)
  })
})

describe('zoom', () => {
  it('SET_SCALE sets a free zoom and a matching header style, within limits', () => {
    const state = twoTaskState()
    const next = projectReducer(state, { type: 'SET_SCALE', pxPerDay: 30 })
    expect(next.project.view.pxPerDay).toBe(30)
    expect(next.project.view.zoom).toBe('day')
    expect(projectReducer(state, { type: 'SET_SCALE', pxPerDay: 99999 }).project.view.pxPerDay).toBe(80)
    expect(next.history.past).toHaveLength(0)
  })

  it('choosing a preset zoom clears the free zoom', () => {
    let state = projectReducer(twoTaskState(), { type: 'SET_SCALE', pxPerDay: 30 })
    state = projectReducer(state, { type: 'SET_ZOOM', zoom: 'month' })
    expect(state.project.view.zoom).toBe('month')
    expect(state.project.view.pxPerDay).toBeNull()
  })
})

describe('MOVE_TASK', () => {
  /**
   * Builds a state with a group (g) holding two children (c1, c2) followed by two top-level tasks (a, b).
   * @returns {object} the reducer state
   */
  function treeState() {
    const base = twoTaskState()
    const make = (id, name, parentId, order, type = 'task') => ({
      ...base.project.tasks[0],
      id,
      name,
      parentId,
      order,
      type,
    })
    const project = {
      ...base.project,
      tasks: [
        make('g', 'Group', null, 0, 'group'),
        make('c1', 'Child 1', 'g', 1),
        make('c2', 'Child 2', 'g', 2),
        make('a', 'A', null, 3),
        make('b', 'B', null, 4),
      ],
    }
    return createInitialState(project)
  }

  /**
   * Lists task ids in display order with their parents, for readable assertions.
   * @param {object} state - the reducer state
   * @returns {string[]} entries like "g>c1" (parent>child) or "a" for top-level tasks
   */
  function layout(state) {
    return [...state.project.tasks]
      .sort((x, y) => x.order - y.order)
      .map((t) => (t.parentId ? `${t.parentId}>${t.id}` : t.id))
  }

  it('moves a task before another at the same level', () => {
    const next = projectReducer(treeState(), { type: 'MOVE_TASK', taskId: 'b', targetId: 'a', position: 'before' })
    expect(layout(next)).toEqual(['g', 'g>c1', 'g>c2', 'b', 'a'])
    expect(next.history.past).toHaveLength(1)
  })

  it('moves a task after another', () => {
    const next = projectReducer(treeState(), { type: 'MOVE_TASK', taskId: 'a', targetId: 'b', position: 'after' })
    expect(layout(next)).toEqual(['g', 'g>c1', 'g>c2', 'b', 'a'])
  })

  it('moves a whole group, children and all, after another task', () => {
    const next = projectReducer(treeState(), { type: 'MOVE_TASK', taskId: 'g', targetId: 'a', position: 'after' })
    expect(layout(next)).toEqual(['a', 'g', 'g>c1', 'g>c2', 'b'])
  })

  it('moves a task inside a group, at the end, and expands the group', () => {
    const state = treeState()
    state.project.tasks = state.project.tasks.map((t) => (t.id === 'g' ? { ...t, collapsed: true } : t))
    const next = projectReducer(state, { type: 'MOVE_TASK', taskId: 'a', targetId: 'g', position: 'inside' })
    expect(layout(next)).toEqual(['g', 'g>c1', 'g>c2', 'g>a', 'b'])
    expect(next.project.tasks.find((t) => t.id === 'g').collapsed).toBe(false)
  })

  it('moves a child out of its group by dropping it after a top-level task', () => {
    const next = projectReducer(treeState(), { type: 'MOVE_TASK', taskId: 'c1', targetId: 'a', position: 'after' })
    expect(layout(next)).toEqual(['g', 'g>c2', 'a', 'c1', 'b'])
  })

  it('treats "inside" a plain task as "after"', () => {
    const next = projectReducer(treeState(), { type: 'MOVE_TASK', taskId: 'b', targetId: 'a', position: 'inside' })
    expect(layout(next)).toEqual(['g', 'g>c1', 'g>c2', 'a', 'b'])
  })

  it('refuses to drop a group into itself or its own children', () => {
    const state = treeState()
    expect(projectReducer(state, { type: 'MOVE_TASK', taskId: 'g', targetId: 'c1', position: 'after' })).toBe(state)
    expect(projectReducer(state, { type: 'MOVE_TASK', taskId: 'g', targetId: 'g', position: 'inside' })).toBe(state)
  })

  it('does nothing, and adds no undo step, when the task would stay where it is', () => {
    const state = treeState()
    expect(projectReducer(state, { type: 'MOVE_TASK', taskId: 'a', targetId: 'b', position: 'before' })).toBe(state)
  })

  it('can be undone', () => {
    const state = treeState()
    const next = projectReducer(state, { type: 'MOVE_TASK', taskId: 'b', targetId: 'a', position: 'before' })
    expect(layout(projectReducer(next, { type: 'UNDO' }))).toEqual(layout(state))
  })
})

describe('SET_CALENDAR', () => {
  it('moves tasks that start on a new holiday to the next working day, and can be undone', () => {
    const state = twoTaskState() // both tasks start Mon 2026-10-05
    const calendar = {
      workingDays: [1, 2, 3, 4, 5],
      nonWorkingDates: ['2026-10-05', '2026-10-06'],
      weekStartsOn: 1,
    }

    const next = projectReducer(state, { type: 'SET_CALENDAR', calendar })
    expect(next.project.calendar).toEqual(calendar)
    expect(next.project.tasks.map((t) => t.start)).toEqual(['2026-10-07', '2026-10-07'])
    expect(next.history.past).toHaveLength(1)

    const undone = projectReducer(next, { type: 'UNDO' })
    expect(undone.project.tasks.map((t) => t.start)).toEqual(['2026-10-05', '2026-10-05'])
    expect(undone.project.calendar.nonWorkingDates).toEqual([])
  })
})

describe('undo and redo', () => {
  it('reverts a rename and can redo it again', () => {
    const state = twoTaskState()
    const renamed = projectReducer(state, { type: 'RENAME_TASK', taskId: 'a', name: 'Renamed' })
    expect(renamed.project.tasks.find((t) => t.id === 'a').name).toBe('Renamed')

    const undone = projectReducer(renamed, { type: 'UNDO' })
    expect(undone.project.tasks.find((t) => t.id === 'a').name).toBe('Task A')

    const redone = projectReducer(undone, { type: 'REDO' })
    expect(redone.project.tasks.find((t) => t.id === 'a').name).toBe('Renamed')
  })

  it('does nothing when there is nothing to undo or redo', () => {
    const state = twoTaskState()
    expect(projectReducer(state, { type: 'UNDO' })).toBe(state)
    expect(projectReducer(state, { type: 'REDO' })).toBe(state)
  })

  it('coalesces a drag into a single undo step', () => {
    let state = twoTaskState()
    state = projectReducer(state, { type: 'BEGIN_DRAG' })
    state = projectReducer(state, { type: 'DRAG_PREVIEW', taskId: 'a', fields: { start: '2026-10-06' } })
    state = projectReducer(state, { type: 'DRAG_PREVIEW', taskId: 'a', fields: { start: '2026-10-07' } })
    state = projectReducer(state, { type: 'DRAG_PREVIEW', taskId: 'a', fields: { start: '2026-10-08' } })
    state = projectReducer(state, { type: 'END_DRAG' })

    expect(state.project.tasks.find((t) => t.id === 'a').start).toBe('2026-10-08')
    expect(state.history.past).toHaveLength(1)

    const undone = projectReducer(state, { type: 'UNDO' })
    expect(undone.project.tasks.find((t) => t.id === 'a').start).toBe('2026-10-05')
  })

  it('restores the pre-drag state on cancel', () => {
    let state = twoTaskState()
    state = projectReducer(state, { type: 'BEGIN_DRAG' })
    state = projectReducer(state, { type: 'DRAG_PREVIEW', taskId: 'a', fields: { start: '2026-10-09' } })
    state = projectReducer(state, { type: 'CANCEL_DRAG' })

    expect(state.project.tasks.find((t) => t.id === 'a').start).toBe('2026-10-05')
    expect(state.history.past).toHaveLength(0)
  })

  it('undoes and redoes a mix of drag, resize, edit, indent and delete step by step', () => {
    const slice = (st) => JSON.stringify({ t: st.project.tasks, d: st.project.dependencies })
    const steps = [
      (st) => projectReducer(projectReducer(projectReducer(st, { type: 'BEGIN_DRAG' }), { type: 'DRAG_PREVIEW', taskId: 'a', fields: { start: '2026-10-07' } }), { type: 'END_DRAG' }),
      (st) => projectReducer(projectReducer(projectReducer(st, { type: 'BEGIN_DRAG' }), { type: 'DRAG_PREVIEW', taskId: 'a', fields: { durationDays: 4 } }), { type: 'END_DRAG' }),
      (st) => projectReducer(st, { type: 'RENAME_TASK', taskId: 'b', name: 'Renamed' }),
      (st) => projectReducer(st, { type: 'INDENT_TASK', taskId: 'b' }),
      (st) => projectReducer(st, { type: 'DELETE_TASK', taskId: 'a' }),
    ]

    const snapshots = []
    let state = twoTaskState()
    for (const step of steps) {
      snapshots.push(slice(state))
      state = step(state)
    }
    const finalSlice = slice(state)
    expect(state.history.past).toHaveLength(steps.length)

    for (let i = steps.length - 1; i >= 0; i--) {
      state = projectReducer(state, { type: 'UNDO' })
      expect(slice(state)).toBe(snapshots[i])
    }
    for (let i = 0; i < steps.length; i++) {
      state = projectReducer(state, { type: 'REDO' })
    }
    expect(slice(state)).toBe(finalSlice)
  })

  it('trims history to the maximum undo depth', () => {
    let state = twoTaskState()
    for (let i = 0; i < 150; i++) {
      state = projectReducer(state, { type: 'RENAME_TASK', taskId: 'a', name: `Name ${i}` })
    }
    expect(state.history.past).toHaveLength(100)
  })
})
