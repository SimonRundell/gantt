/**
 * The scheduling engine: everything about turning task start dates,
 * durations and dependencies into a consistent, conflict-free plan.
 * Every function here is pure - it takes data in and returns new data,
 * never touching the DOM or mutating its arguments - so it can be unit
 * tested on its own and reused from the reducer without surprises.
 * @module lib/scheduler
 */

import { maxISODate, minISODate } from './dates.js'
import { shiftByWorkingDays, snapForwardToWorkingDay, workingDaysBetween } from './calendar.js'

export { workingDaysBetween }

/**
 * Moves a date forward or backward by a number of working days. Thin
 * wrapper over `calendar.shiftByWorkingDays`, named to match the
 * vocabulary used elsewhere in the scheduler (and in the brief this
 * project was built from).
 * @param {string} startISO - a `YYYY-MM-DD` string
 * @param {number} n - number of working days to move, may be negative
 * @param {import('./calendar.js').WorkingCalendar} calendar - the project's working calendar
 * @returns {string} the resulting working day
 */
export function addWorkingDays(startISO, n, calendar) {
  return shiftByWorkingDays(startISO, n, calendar)
}

/**
 * How many working days a task spans after its start date: zero for a
 * milestone or a zero-duration task, otherwise one less than its
 * duration (a one day task starts and ends on the same day).
 * @param {import('./scheduler.js').Task} task - the task to measure
 * @returns {number} working days from the task's start to its end
 */
function effectiveSpan(task) {
  if (task.type === 'milestone') return 0
  const duration = Math.max(task.durationDays ?? 1, 0)
  return duration === 0 ? 0 : duration - 1
}

/**
 * @typedef {object} Task
 * @property {string} id
 * @property {string|null} parentId
 * @property {'task'|'group'|'milestone'} type
 * @property {string} name
 * @property {string} start - `YYYY-MM-DD`
 * @property {number} durationDays
 * @property {number} percent
 */

/**
 * @typedef {object} Dependency
 * @property {string} id
 * @property {string} from - predecessor task id
 * @property {string} to - successor task id
 * @property {'FS'|'SS'|'FF'|'SF'} type
 * @property {number} lagDays - working days of lag, may be negative
 */

/**
 * Derives a task's end date from its start, duration and type. A
 * milestone or zero-duration task ends on the same (working) day it
 * starts. A start date that falls on a non-working day is snapped
 * forward before the duration is applied.
 * @param {Task} task - the task to compute an end date for
 * @param {import('./calendar.js').WorkingCalendar} calendar - the project's working calendar
 * @returns {string} the task's end date, `YYYY-MM-DD`
 */
export function computeEnd(task, calendar) {
  if (task.type === 'milestone') {
    return snapForwardToWorkingDay(task.start, calendar)
  }

  const duration = Math.max(task.durationDays ?? 1, 0)
  if (duration === 0) {
    return snapForwardToWorkingDay(task.start, calendar)
  }

  return shiftByWorkingDays(task.start, duration - 1, calendar)
}

/**
 * Finds the minimum start date a successor task must have to satisfy
 * one dependency edge, given its predecessor's current schedule.
 * @param {Task} pred - the predecessor task, already scheduled
 * @param {Task} succ - the successor task
 * @param {Dependency} dep - the dependency edge linking them
 * @param {import('./calendar.js').WorkingCalendar} calendar - the project's working calendar
 * @returns {string} the earliest start date that satisfies this dependency
 */
function requiredMinStart(pred, succ, dep, calendar) {
  const predEnd = computeEnd(pred, calendar)
  const lag = dep.lagDays ?? 0
  const succSpan = effectiveSpan(succ)

  switch (dep.type) {
    case 'FS':
      return shiftByWorkingDays(predEnd, 1 + lag, calendar)
    case 'SS':
      return shiftByWorkingDays(pred.start, lag, calendar)
    case 'FF': {
      const minEnd = shiftByWorkingDays(predEnd, lag, calendar)
      return shiftByWorkingDays(minEnd, -succSpan, calendar)
    }
    case 'SF': {
      const minEnd = shiftByWorkingDays(pred.start, lag, calendar)
      return shiftByWorkingDays(minEnd, -succSpan, calendar)
    }
    default:
      return succ.start
  }
}

/**
 * Re-schedules the successors of the given tasks so every dependency
 * is satisfied, after a start date, duration or dependency has
 * changed. Only ever pushes a successor later; it never pulls a task
 * earlier automatically, so moving a predecessor back never surprises
 * a student by yanking something else earlier too. Assumes the caller
 * has already confirmed the dependency graph is cycle-free.
 * @param {{calendar: import('./calendar.js').WorkingCalendar, tasks: Task[], dependencies: Dependency[]}} project - the project document
 * @param {string[]} changedTaskIds - ids of tasks whose start, duration or dependencies just changed
 * @returns {{tasks: Task[], changedTaskIds: string[]}} the updated task list and which tasks moved
 */
export function applyDependencies(project, changedTaskIds) {
  const { calendar, tasks, dependencies } = project
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]))

  const dependentsByFrom = new Map()
  const dependenciesByTo = new Map()
  for (const dep of dependencies) {
    if (!dependentsByFrom.has(dep.from)) dependentsByFrom.set(dep.from, [])
    dependentsByFrom.get(dep.from).push(dep)
    if (!dependenciesByTo.has(dep.to)) dependenciesByTo.set(dep.to, [])
    dependenciesByTo.get(dep.to).push(dep)
  }

  const queue = []
  const queued = new Set()
  const enqueue = (id) => {
    if (!queued.has(id)) {
      queued.add(id)
      queue.push(id)
    }
  }

  for (const id of changedTaskIds) {
    for (const dep of dependentsByFrom.get(id) ?? []) enqueue(dep.to)
  }

  const changed = new Set()
  const guardLimit = (tasks.length + 1) * (dependencies.length + 1) * 4 + 100
  let guard = 0

  while (queue.length > 0 && guard < guardLimit) {
    guard += 1
    const id = queue.shift()
    queued.delete(id)

    const succ = byId.get(id)
    if (!succ || succ.type === 'group') continue

    let required = null
    for (const dep of dependenciesByTo.get(id) ?? []) {
      const pred = byId.get(dep.from)
      if (!pred) continue
      const candidate = requiredMinStart(pred, succ, dep, calendar)
      required = required === null ? candidate : maxISODate(required, candidate)
    }

    if (required !== null && required > succ.start) {
      succ.start = required
      changed.add(id)
      for (const dep of dependentsByFrom.get(id) ?? []) enqueue(dep.to)
    }
  }

  return {
    tasks: tasks.map((t) => byId.get(t.id) ?? t),
    changedTaskIds: [...changed],
  }
}

/**
 * Looks for a cycle in the dependency graph using depth-first search.
 * @param {Dependency[]} dependencies - the project's dependencies
 * @returns {string[]|null} the task ids forming a cycle, in order, or null if there isn't one
 */
export function detectCycle(dependencies) {
  const adjacency = new Map()
  for (const dep of dependencies) {
    if (!adjacency.has(dep.from)) adjacency.set(dep.from, [])
    adjacency.get(dep.from).push(dep.to)
  }

  const visited = new Set()
  const onStack = new Set()
  const stack = []

  const visit = (node) => {
    visited.add(node)
    onStack.add(node)
    stack.push(node)

    for (const next of adjacency.get(node) ?? []) {
      if (!visited.has(next)) {
        const found = visit(next)
        if (found) return found
      } else if (onStack.has(next)) {
        const cycleStart = stack.indexOf(next)
        return [...stack.slice(cycleStart), next]
      }
    }

    stack.pop()
    onStack.delete(node)
    return null
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      const found = visit(node)
      if (found) return found
    }
  }

  return null
}

/**
 * Removes every dependency that touches a task, used when that task
 * is deleted so no dependency is left pointing at a task that no
 * longer exists.
 * @param {Dependency[]} dependencies - the project's dependencies
 * @param {string} taskId - the id of the task being deleted
 * @returns {Dependency[]} the dependencies with any edge touching that task removed
 */
export function removeDependenciesForTask(dependencies, taskId) {
  return dependencies.filter((dep) => dep.from !== taskId && dep.to !== taskId)
}

/**
 * Recomputes every group's start, duration and percent complete from
 * its children, working from the bottom of the hierarchy up so a group
 * containing another group rolls up correctly. Groups with no children
 * keep whatever values they were given.
 * @param {Task[]} tasks - every task in the project, flat
 * @param {import('./calendar.js').WorkingCalendar} calendar - the project's working calendar
 * @returns {Task[]} a new task list with group fields recalculated
 */
export function rollUpGroups(tasks, calendar) {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]))
  const childrenOf = new Map()
  for (const t of tasks) {
    if (t.parentId) {
      if (!childrenOf.has(t.parentId)) childrenOf.set(t.parentId, [])
      childrenOf.get(t.parentId).push(t.id)
    }
  }

  const resolved = new Map()

  const resolve = (id) => {
    if (resolved.has(id)) return resolved.get(id)

    const task = byId.get(id)
    const kids = childrenOf.get(id) ?? []

    if (task.type === 'group' && kids.length > 0) {
      let start = null
      let end = null
      let weightedPercent = 0
      let totalWeight = 0

      for (const childId of kids) {
        const child = resolve(childId)
        start = start === null ? child.start : minISODate(start, child.start)
        end = end === null ? child.end : maxISODate(end, child.end)
        weightedPercent += child.percent * child.weight
        totalWeight += child.weight
      }

      const durationDays = workingDaysBetween(start, end, calendar) + 1
      const percent = totalWeight > 0 ? Math.round(weightedPercent / totalWeight) : 0

      task.start = start
      task.durationDays = durationDays
      task.percent = percent

      const result = { start, end, percent, weight: Math.max(durationDays, 1) }
      resolved.set(id, result)
      return result
    }

    const end = computeEnd(task, calendar)
    const weight = task.type === 'milestone' ? 1 : Math.max(task.durationDays ?? 1, 1)
    const result = { start: task.start, end, percent: task.percent ?? 0, weight }
    resolved.set(id, result)
    return result
  }

  for (const t of tasks) resolve(t.id)

  return tasks.map((t) => byId.get(t.id))
}

/**
 * Runs a forward/backward critical path pass over the non-group tasks
 * in a project. Assumes dates have already been pushed into a
 * consistent state by `applyDependencies` and that the dependency
 * graph is cycle-free. Groups are excluded since their dates are a
 * roll-up of their children rather than an independent schedule.
 * @param {{calendar: import('./calendar.js').WorkingCalendar, tasks: Task[], dependencies: Dependency[]}} project - the project document
 * @returns {{criticalTaskIds: string[], projectEnd: string|null, floatByTaskId: Record<string, number>}} which tasks are critical, the project end date, and each task's float in working days
 */
export function criticalPath(project) {
  const { calendar, tasks, dependencies } = project
  const relevant = tasks.filter((t) => t.type !== 'group')

  if (relevant.length === 0) {
    return { criticalTaskIds: [], projectEnd: null, floatByTaskId: {} }
  }

  const byId = new Map(relevant.map((t) => [t.id, t]))
  const succsOf = new Map()
  const predsOf = new Map()
  for (const dep of dependencies) {
    if (!byId.has(dep.from) || !byId.has(dep.to)) continue
    if (!succsOf.has(dep.from)) succsOf.set(dep.from, [])
    succsOf.get(dep.from).push(dep)
    if (!predsOf.has(dep.to)) predsOf.set(dep.to, [])
    predsOf.get(dep.to).push(dep)
  }

  const es = new Map()
  const ef = new Map()
  for (const t of relevant) {
    es.set(t.id, t.start)
    ef.set(t.id, computeEnd(t, calendar))
  }

  const projectEnd = relevant.reduce((latest, t) => maxISODate(latest, ef.get(t.id)), ef.get(relevant[0].id))

  const inDegree = new Map(relevant.map((t) => [t.id, 0]))
  for (const t of relevant) {
    for (const dep of succsOf.get(t.id) ?? []) {
      inDegree.set(dep.to, (inDegree.get(dep.to) ?? 0) + 1)
    }
  }

  const order = []
  const queue = relevant.filter((t) => inDegree.get(t.id) === 0).map((t) => t.id)
  while (queue.length > 0) {
    const id = queue.shift()
    order.push(id)
    for (const dep of succsOf.get(id) ?? []) {
      const next = inDegree.get(dep.to) - 1
      inDegree.set(dep.to, next)
      if (next === 0) queue.push(dep.to)
    }
  }

  if (order.length < relevant.length) {
    // A cycle slipped through; the caller should have rejected it with
    // detectCycle already, so bail out rather than loop forever.
    return { criticalTaskIds: [], projectEnd, floatByTaskId: {} }
  }

  const lf = new Map()
  const ls = new Map()

  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    const task = byId.get(id)
    const succs = succsOf.get(id) ?? []
    const span = effectiveSpan(task)

    let latestFinish = null
    for (const dep of succs) {
      const lag = dep.lagDays ?? 0
      const succLS = ls.get(dep.to)
      const succLF = lf.get(dep.to)
      let candidate

      switch (dep.type) {
        case 'FS':
          candidate = shiftByWorkingDays(succLS, -(1 + lag), calendar)
          break
        case 'SS':
          candidate = shiftByWorkingDays(shiftByWorkingDays(succLS, -lag, calendar), span, calendar)
          break
        case 'FF':
          candidate = shiftByWorkingDays(succLF, -lag, calendar)
          break
        case 'SF':
          candidate = shiftByWorkingDays(shiftByWorkingDays(succLF, -lag, calendar), span, calendar)
          break
        default:
          candidate = projectEnd
      }

      latestFinish = latestFinish === null ? candidate : minISODate(latestFinish, candidate)
    }

    if (latestFinish === null) {
      latestFinish = projectEnd
    }

    lf.set(id, latestFinish)
    ls.set(id, shiftByWorkingDays(latestFinish, -span, calendar))
  }

  const floatByTaskId = {}
  const criticalTaskIds = []
  for (const t of relevant) {
    const float = workingDaysBetween(es.get(t.id), ls.get(t.id), calendar)
    floatByTaskId[t.id] = float
    if (float <= 0) criticalTaskIds.push(t.id)
  }

  return { criticalTaskIds, projectEnd, floatByTaskId }
}
