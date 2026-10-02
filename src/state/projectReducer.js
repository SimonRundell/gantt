/**
 * The single reducer behind the editor. Every edit a student makes -
 * typing a name, dragging a bar, adding a dependency - goes through
 * here, so scheduling (lib/scheduler.js) always runs consistently and
 * undo/redo always has a clean snapshot to go back to.
 * @module state/projectReducer
 */

import { snapForwardToWorkingDay } from '../lib/calendar.js'
import { scheduleImported } from '../lib/csvTasks.js'
import { generateId } from '../lib/id.js'
import { applyDependencies, detectCycle, removeDependenciesForTask, rollUpGroups } from '../lib/scheduler.js'
import { collectSubtreeIds, renumberOrder } from '../lib/taskTree.js'
import { todayISO } from '../lib/dates.js'
import { clampPxPerDay, levelForPxPerDay } from '../lib/timelineScale.js'

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
      // Choosing a preset level clears any free (mouse wheel) zoom.
      const view = { ...state.project.view, zoom: action.zoom, pxPerDay: null }
      return { ...state, project: { ...state.project, view } }
    }

    case 'SET_SCALE': {
      // A free zoom from the mouse wheel. `zoom` follows to the nearest
      // header style so anything that only knows the presets stays sensible.
      const pxPerDay = clampPxPerDay(action.pxPerDay)
      const view = { ...state.project.view, pxPerDay, zoom: levelForPxPerDay(pxPerDay) }
      return { ...state, project: { ...state.project, view } }
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
      // Tasks that now start on a non-working day (a new holiday, say)
      // move forward to the next working day. Groups roll up from their
      // children, so only real tasks and milestones are snapped.
      const tasks = state.project.tasks.map((t) =>
        t.type === 'group' ? t : { ...t, start: snapForwardToWorkingDay(t.start, action.calendar) },
      )
      const project = reschedule(
        { ...state.project, calendar: action.calendar, tasks },
        tasks.map((t) => t.id),
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

    case 'MOVE_TASK': {
      const { taskId, targetId, position } = action
      const task = state.project.tasks.find((t) => t.id === taskId)
      const target = state.project.tasks.find((t) => t.id === targetId)
      if (!task || !target || taskId === targetId) return state

      // A task cannot be dropped inside itself or any of its own children.
      const ownSubtree = new Set(collectSubtreeIds(state.project.tasks, taskId))
      if (ownSubtree.has(targetId)) return state

      // "Inside" only makes sense for a group; anywhere else it means "after".
      const placement = position === 'inside' && target.type !== 'group' ? 'after' : position

      let parentId
      let order
      if (placement === 'inside') {
        parentId = target.id
        order = state.project.tasks.length + 1 // the end of the group's children
      } else if (placement === 'before') {
        parentId = target.parentId ?? null
        order = target.order - 0.5
      } else {
        parentId = target.parentId ?? null
        const targetSubtree = collectSubtreeIds(state.project.tasks, targetId)
        const lastOrder = Math.max(...state.project.tasks.filter((t) => targetSubtree.includes(t.id)).map((t) => t.order))
        order = lastOrder + 0.5
      }

      const moved = renumberOrder(
        state.project.tasks.map((t) => {
          if (t.id === taskId) return { ...t, parentId, order }
          if (placement === 'inside' && t.id === target.id) return { ...t, collapsed: false }
          return t
        }),
      )

      const unchanged = moved.every((t, i) => {
        const before = state.project.tasks[i]
        return t.parentId === before.parentId && t.order === before.order
      })
      if (unchanged) return state

      const history = pushHistory(state)
      const project = reschedule({ ...state.project, tasks: moved }, [])
      return { ...state, history, project }
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

    case 'DUPLICATE_TASK': {
      const original = state.project.tasks.find((t) => t.id === action.taskId)
      if (!original) return state

      const history = pushHistory(state)
      const subtreeIds = collectSubtreeIds(state.project.tasks, original.id)
      const idMap = new Map(subtreeIds.map((id) => [id, generateId('t')]))

      const copies = state.project.tasks
        .filter((t) => idMap.has(t.id))
        .map((t) => {
          const isRoot = t.id === original.id
          return {
            ...t,
            id: idMap.get(t.id),
            parentId: isRoot ? t.parentId : idMap.get(t.parentId),
            name: isRoot ? `${t.name} (copy)` : t.name,
            // Sit straight after the original; renumberOrder tidies this up.
            order: isRoot ? t.order + 0.5 : t.order,
            baseline: null,
          }
        })

      // Dependencies wholly inside the copied subtree are copied too, so
      // a duplicated group keeps its internal structure. Links to tasks
      // outside it are not copied.
      const copiedDependencies = state.project.dependencies
        .filter((d) => idMap.has(d.from) && idMap.has(d.to))
        .map((d) => ({ ...d, id: generateId('d'), from: idMap.get(d.from), to: idMap.get(d.to) }))

      const tasks = renumberOrder([...state.project.tasks, ...copies])
      const dependencies = [...state.project.dependencies, ...copiedDependencies]
      const project = reschedule({ ...state.project, tasks, dependencies }, [])
      return { ...state, history, project, selection: { taskId: idMap.get(original.id) } }
    }

    case 'IMPORT_TASKS': {
      const history = pushHistory(state)
      const replace = action.mode === 'replace'
      const existingTasks = replace ? [] : state.project.tasks
      const existingDependencies = replace ? [] : state.project.dependencies

      // New tasks go after everything already there; renumberOrder tidies up.
      const incoming = action.tasks.map((t) => ({ ...t, order: t.order + existingTasks.length }))
      const tasks = renumberOrder([...existingTasks, ...incoming])
      const dependencies = [...existingDependencies, ...action.dependencies]
      const scheduled = scheduleImported(
        { ...state.project, tasks, dependencies },
        new Set(incoming.map((t) => t.id)),
      )
      return {
        ...state,
        history,
        project: { ...state.project, tasks: scheduled, dependencies },
        selection: { taskId: null },
      }
    }

    case 'SET_BASELINE': {
      const history = pushHistory(state)
      const tasks = state.project.tasks.map((t) => ({
        ...t,
        baseline: { start: t.start, durationDays: t.durationDays },
      }))
      const view = { ...state.project.view, showBaseline: true }
      return { ...state, history, project: { ...state.project, tasks, view } }
    }

    case 'CLEAR_BASELINE': {
      const history = pushHistory(state)
      const tasks = state.project.tasks.map((t) => ({ ...t, baseline: null }))
      const view = { ...state.project.view, showBaseline: false }
      return { ...state, history, project: { ...state.project, tasks, view } }
    }

    case 'SET_VIEW_OPTION': {
      const view = { ...state.project.view, [action.key]: action.value }
      return { ...state, project: { ...state.project, view } }
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
      const tasks = state.project.tasks.map((t) => (t.id === action.taskId ? { ...t, ...action.fields } : t))
      const changedIds = 'start' in action.fields || 'durationDays' in action.fields ? [action.taskId] : []
      const project = reschedule({ ...state.project, tasks }, changedIds)
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

    case 'SET_SERVER_META': {
      // Bookkeeping only (id, revision, timestamps) - never part of
      // undo history, since reverting a save's revision number would
      // not make sense to a student pressing Ctrl+Z.
      return { ...state, project: { ...state.project, ...action.fields } }
    }

    case 'DISMISS_ERROR': {
      return { ...state, ui: { ...state.ui, lastError: null } }
    }

    case 'IMPORT_PROJECT': {
      // Replaces the working chart's content with an uploaded file,
      // keeping this browser's undo history (one more undo step gets
      // you back to what was there before) and the server identity
      // (id, revision) that lives outside the reducer entirely.
      const history = pushHistory(state)
      const incoming = action.project
      const project = reschedule(
        {
          ...state.project,
          title: incoming.title,
          calendar: incoming.calendar,
          view: incoming.view ?? state.project.view,
          tasks: renumberOrder(incoming.tasks),
          dependencies: incoming.dependencies,
        },
        [],
      )
      return { ...state, history, project, selection: { taskId: null } }
    }

    default:
      return state
  }
}
