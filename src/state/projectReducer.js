/**
 * The single reducer behind the editor. Every edit a student makes -
 * typing a name, dragging a bar, adding a dependency - goes through
 * here, so scheduling (lib/scheduler.js) always runs consistently and
 * undo/redo always has a clean snapshot to go back to.
 * @module state/projectReducer
 */

import { generateId } from '../lib/id.js'
import { applyDependencies, detectCycle, removeDependenciesForTask, rollUpGroups } from '../lib/scheduler.js'
import { collectSubtreeIds, renumberOrder } from '../lib/taskTree.js'
import { todayISO } from '../lib/dates.js'

/** @type {number} how many undo steps to keep */
const MAX_HISTORY = 100

/**
 * Builds the initial reducer state around a loaded or freshly created
 * project document.
 * @param {object} project - a full project document
 * @returns {object} the initial editor state
 */
export function createInitialState(project) {
  return {
    project,
    selection: { taskId: null },
    history: { past: [], future: [] },
    dragSnapshot: null,
    ui: { lastError: null, saveStatus: 'idle' },
  }
}

/**
 * Pulls out the part of a project document that undo/redo cares
 * about: the planning content, not view preferences or housekeeping
 * fields like `updatedAt`.
 * @param {object} project - a full project document
 * @returns {{title: string, calendar: object, tasks: object[], dependencies: object[]}} the undoable slice
 */
function undoableSlice(project) {
  return {
    title: project.title,
    calendar: project.calendar,
    tasks: project.tasks,
    dependencies: project.dependencies,
  }
}

/**
 * Re-runs the scheduling pipeline: pushes successors forward to
 * satisfy dependencies, then rolls group dates and percentages up
 * from their children. Called after any edit that can affect dates.
 * @param {object} project - the project to reschedule
 * @param {string[]} changedTaskIds - ids of tasks whose dates just changed directly
 * @returns {object} a new project with tasks rescheduled and groups rolled up
 */
function reschedule(project, changedTaskIds) {
  const afterDeps = applyDependencies(project, changedTaskIds)
  const rolledUp = rollUpGroups(afterDeps.tasks, project.calendar)
  return { ...project, tasks: rolledUp }
}

/**
 * Pushes the current undoable project state onto the history stack
 * before an edit is applied, trimming to the maximum undo depth and
 * clearing the redo stack (a fresh edit retires any pending redo).
 * @param {object} state - the current reducer state
 * @returns {{past: object[], future: object[]}} the updated history
 */
function pushHistory(state) {
  const past = [...state.history.past, undoableSlice(state.project)].slice(-MAX_HISTORY)
  return { past, future: [] }
}

/**
 * Builds the default fields for a brand new task.
 * @param {object} project - the project the task is being added to
 * @param {object|null} afterTask - the task it is being inserted after, if any
 * @param {'task'|'group'|'milestone'} type - the kind of task to create
 * @returns {object} a new task record (parentId and order are set by the caller)
 */
function makeNewTask(project, afterTask, type) {
  const earliestStart = project.tasks.reduce(
    (earliest, t) => (earliest === null || t.start < earliest ? t.start : earliest),
    null,
  )
  const start = afterTask ? afterTask.start : (earliestStart ?? todayISO())

  return {
    id: generateId('t'),
    parentId: null,
    type,
    name: type === 'milestone' ? 'New milestone' : type === 'group' ? 'New group' : 'New task',
    start,
    durationDays: type === 'milestone' ? 0 : 1,
    percent: 0,
    assignee: '',
    colour: 'blue',
    notes: '',
    collapsed: false,
    order: 0,
    baseline: null,
  }
}

/**
 * The project editor's reducer.
 * @param {object} state - the current editor state
 * @param {{type: string, [key: string]: unknown}} action - the dispatched action
 * @returns {object} the next editor state
 */
export function projectReducer(state, action) {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      return createInitialState(action.project)
    }

    case 'SELECT_TASK': {
      return { ...state, selection: { taskId: action.taskId } }
    }

    case 'SET_ZOOM': {
      return { ...state, project: { ...state.project, view: { ...state.project.view, zoom: action.zoom } } }
    }

    case 'TOGGLE_CRITICAL_PATH': {
      const view = { ...state.project.view, showCriticalPath: !state.project.view.showCriticalPath }
      return { ...state, project: { ...state.project, view } }
    }

    case 'TOGGLE_BASELINE': {
      const view = { ...state.project.view, showBaseline: !state.project.view.showBaseline }
      return { ...state, project: { ...state.project, view } }
    }

    case 'SET_COLUMNS': {
      const view = { ...state.project.view, columns: action.columns }
      return { ...state, project: { ...state.project, view } }
    }

    case 'TOGGLE_COLLAPSE': {
      const tasks = state.project.tasks.map((t) =>
        t.id === action.taskId ? { ...t, collapsed: !t.collapsed } : t,
      )
      return { ...state, project: { ...state.project, tasks } }
    }

    case 'SET_TITLE': {
      const history = pushHistory(state)
      return { ...state, history, project: { ...state.project, title: action.title } }
    }

    case 'SET_CALENDAR': {
      const history = pushHistory(state)
      const project = reschedule(
        { ...state.project, calendar: action.calendar },
        state.project.tasks.map((t) => t.id),
      )
      return { ...state, history, project }
    }

    case 'UPDATE_TASK_FIELDS': {
      const history = pushHistory(state)
      const tasks = state.project.tasks.map((t) =>
        t.id === action.taskId ? { ...t, ...action.fields } : t,
      )
      const changedIds = 'start' in action.fields || 'durationDays' in action.fields ? [action.taskId] : []
      const project = reschedule({ ...state.project, tasks }, changedIds)
      return { ...state, history, project }
    }

    case 'ADD_TASK': {
      const history = pushHistory(state)
      const afterTask = action.afterTaskId
        ? state.project.tasks.find((t) => t.id === action.afterTaskId)
        : null
      const task = makeNewTask(state.project, afterTask, action.taskType ?? 'task')
      task.parentId = action.parentId ?? afterTask?.parentId ?? null
      task.order = afterTask ? afterTask.order + 0.5 : state.project.tasks.length

      const tasks = renumberOrder([...state.project.tasks, task])
      const project = reschedule({ ...state.project, tasks }, [task.id])
      return { ...state, history, project, selection: { taskId: task.id } }
    }

    case 'RENAME_TASK': {
      const history = pushHistory(state)
      const tasks = state.project.tasks.map((t) => (t.id === action.taskId ? { ...t, name: action.name } : t))
      return { ...state, history, project: { ...state.project, tasks } }
    }

    case 'DELETE_TASK': {
      const history = pushHistory(state)
      const idsToRemove = new Set(collectSubtreeIds(state.project.tasks, action.taskId))
      let tasks = state.project.tasks.filter((t) => !idsToRemove.has(t.id))
      let dependencies = state.project.dependencies
      for (const id of idsToRemove) {
        dependencies = removeDependenciesForTask(dependencies, id)
      }
      tasks = renumberOrder(tasks)
      const project = reschedule({ ...state.project, tasks, dependencies }, [])
      const selection = idsToRemove.has(state.selection.taskId) ? { taskId: null } : state.selection
      return { ...state, history, project, selection }
    }

    case 'REORDER_TASK': {
      const { taskId, direction } = action
      const task = state.project.tasks.find((t) => t.id === taskId)
      if (!task) return state

      const siblings = state.project.tasks
        .filter((t) => (t.parentId ?? null) === (task.parentId ?? null))
        .sort((a, b) => a.order - b.order)
      const index = siblings.findIndex((t) => t.id === taskId)
      const swapIndex = direction === 'up' ? index - 1 : index + 1
      if (swapIndex < 0 || swapIndex >= siblings.length) return state

      const history = pushHistory(state)
      const other = siblings[swapIndex]
      const tasks = renumberOrder(
        state.project.tasks.map((t) => {
          if (t.id === task.id) return { ...t, order: other.order }
          if (t.id === other.id) return { ...t, order: task.order }
          return t
        }),
      )
      return { ...state, history, project: { ...state.project, tasks } }
    }

    case 'INDENT_TASK': {
      const task = state.project.tasks.find((t) => t.id === action.taskId)
      if (!task) return state

      const siblings = state.project.tasks
        .filter((t) => (t.parentId ?? null) === (task.parentId ?? null))
        .sort((a, b) => a.order - b.order)
      const index = siblings.findIndex((t) => t.id === task.id)
      const newParent = siblings[index - 1]
      if (!newParent || newParent.type === 'milestone') return state

      const history = pushHistory(state)
      const tasks = renumberOrder(
        state.project.tasks.map((t) =>
          t.id === task.id ? { ...t, parentId: newParent.id, type: t.type === 'group' ? t.type : t.type } : t,
        ),
      )
      const project = reschedule({ ...state.project, tasks }, [])
      return { ...state, history, project }
    }

    case 'OUTDENT_TASK': {
      const task = state.project.tasks.find((t) => t.id === action.taskId)
      if (!task || !task.parentId) return state

      const parent = state.project.tasks.find((t) => t.id === task.parentId)
      const history = pushHistory(state)
      const tasks = renumberOrder(
        state.project.tasks.map((t) =>
          t.id === task.id ? { ...t, parentId: parent?.parentId ?? null } : t,
        ),
      )
      const project = reschedule({ ...state.project, tasks }, [])
      return { ...state, history, project }
    }

    case 'SET_TASK_TYPE': {
      const history = pushHistory(state)
      const tasks = state.project.tasks.map((t) =>
        t.id === action.taskId
          ? { ...t, type: action.taskType, durationDays: action.taskType === 'milestone' ? 0 : t.durationDays || 1 }
          : t,
      )
      const project = reschedule({ ...state.project, tasks }, [action.taskId])
      return { ...state, history, project }
    }

    case 'ADD_DEPENDENCY': {
      const { from, to, depType, lagDays } = action
      if (from === to) {
        return { ...state, ui: { ...state.ui, lastError: 'A task cannot depend on itself.' } }
      }

      const candidateDependencies = [
        ...state.project.dependencies,
        { id: generateId('d'), from, to, type: depType, lagDays: lagDays ?? 0 },
      ]
      const cycle = detectCycle(candidateDependencies)
      if (cycle) {
        return {
          ...state,
          ui: { ...state.ui, lastError: 'That would create a circular dependency, so it was not added.' },
        }
      }

      const history = pushHistory(state)
      // Seed the reschedule from the predecessor, since applyDependencies
      // looks up what depends on a changed task, not the task itself.
      const project = reschedule({ ...state.project, dependencies: candidateDependencies }, [from])
      return { ...state, history, project, ui: { ...state.ui, lastError: null } }
    }

    case 'UPDATE_DEPENDENCY': {
      const history = pushHistory(state)
      const dependencies = state.project.dependencies.map((d) =>
        d.id === action.dependencyId ? { ...d, ...action.fields } : d,
      )
      const dep = dependencies.find((d) => d.id === action.dependencyId)
      const project = reschedule({ ...state.project, dependencies }, dep ? [dep.from] : [])
      return { ...state, history, project }
    }

    case 'DELETE_DEPENDENCY': {
      const history = pushHistory(state)
      const dependencies = state.project.dependencies.filter((d) => d.id !== action.dependencyId)
      return { ...state, history, project: { ...state.project, dependencies } }
    }

    case 'BEGIN_DRAG': {
      return { ...state, dragSnapshot: undoableSlice(state.project) }
    }

    case 'DRAG_PREVIEW': {
      const tasks = state.project.tasks.map((t) =>
        t.id === action.taskId
          ? { ...t, start: action.start, ...(action.durationDays != null ? { durationDays: action.durationDays } : {}) }
          : t,
      )
      const project = reschedule({ ...state.project, tasks }, [action.taskId])
      return { ...state, project }
    }

    case 'END_DRAG': {
      if (!state.dragSnapshot) return state
      const past = [...state.history.past, state.dragSnapshot].slice(-MAX_HISTORY)
      return { ...state, history: { past, future: [] }, dragSnapshot: null }
    }

    case 'CANCEL_DRAG': {
      if (!state.dragSnapshot) return state
      return { ...state, project: { ...state.project, ...state.dragSnapshot }, dragSnapshot: null }
    }

    case 'UNDO': {
      const { past, future } = state.history
      if (past.length === 0) return state
      const previous = past[past.length - 1]
      const newFuture = [undoableSlice(state.project), ...future]
      return {
        ...state,
        history: { past: past.slice(0, -1), future: newFuture },
        project: { ...state.project, ...previous },
      }
    }

    case 'REDO': {
      const { past, future } = state.history
      if (future.length === 0) return state
      const next = future[0]
      const newPast = [...past, undoableSlice(state.project)].slice(-MAX_HISTORY)
      return {
        ...state,
        history: { past: newPast, future: future.slice(1) },
        project: { ...state.project, ...next },
      }
    }

    case 'SET_SAVE_STATUS': {
      return { ...state, ui: { ...state.ui, saveStatus: action.status } }
    }

    case 'DISMISS_ERROR': {
      return { ...state, ui: { ...state.ui, lastError: null } }
    }

    case 'REPLACE_TASKS_AND_DEPENDENCIES': {
      // Used by bulk operations (upload merge, conflict resolution)
      // that already know the full resulting lists.
      const history = pushHistory(state)
      const project = reschedule(
        { ...state.project, tasks: renumberOrder(action.tasks), dependencies: action.dependencies },
        [],
      )
      return { ...state, history, project }
    }

    default:
      return state
  }
}
