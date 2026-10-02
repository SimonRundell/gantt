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
