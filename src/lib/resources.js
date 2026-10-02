/**
 * Summarises who is assigned to what, and spots people who have been
 * given tasks that overlap in time.
 * @module lib/resources
 */

import { computeEnd } from './scheduler.js'

/**
 * @typedef {object} ResourceTask
 * @property {string} id - the task id
 * @property {string} name - the task name
 * @property {string} start - first day, `YYYY-MM-DD`
 * @property {string} end - last day, `YYYY-MM-DD`
 * @property {number} percent - percent complete
 */

/**
 * @typedef {object} ResourceSummary
 * @property {string} name - the person's name as first written
 * @property {ResourceTask[]} tasks - their tasks, earliest first
 * @property {number} openCount - how many of those are not yet 100% complete
 * @property {ResourceTask[][]} overlaps - pairs of their tasks that overlap in time
 */

/**
 * Splits an assignee field into individual names. A task can be shared
 * by writing names separated by commas.
 * @param {string} assignee - the raw assignee text
 * @returns {string[]} the trimmed, non-empty names
 */
export function splitAssignees(assignee) {
  return String(assignee ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

/**
 * Builds a summary for each person assigned to at least one task.
 * Groups are skipped (their dates are just a roll-up of their
 * children), names are matched ignoring upper and lower case, and
 * milestones count as tasks but never as overlapping, since they take
 * no time.
 * @param {import('./scheduler.js').Task[]} tasks - every task in the project
 * @param {import('./calendar.js').WorkingCalendar} calendar - the working calendar
 * @returns {{people: ResourceSummary[], unassignedCount: number}} one summary per person sorted by name, plus how many tasks have nobody assigned
 */
export function summariseResources(tasks, calendar) {
  const byPerson = new Map()
  let unassignedCount = 0

  for (const task of tasks) {
    if (task.type === 'group') continue

    const names = splitAssignees(task.assignee)
    if (names.length === 0) {
      unassignedCount += 1
      continue
    }

    const entry = { id: task.id, name: task.name, start: task.start, end: computeEnd(task, calendar), percent: task.percent }
    for (const name of names) {
      const key = name.toLowerCase()
      if (!byPerson.has(key)) byPerson.set(key, { name, tasks: [], milestoneIds: new Set() })
      const person = byPerson.get(key)
      person.tasks.push(entry)
      if (task.type === 'milestone') person.milestoneIds.add(task.id)
    }
  }

  const people = [...byPerson.values()].map((person) => {
    const sorted = [...person.tasks].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
    const timed = sorted.filter((t) => !person.milestoneIds.has(t.id))
    const overlaps = []
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        if (timed[j].start > timed[i].end) break
        if (timed[i].start <= timed[j].end && timed[j].start <= timed[i].end) overlaps.push([timed[i], timed[j]])
      }
    }
    return {
      name: person.name,
      tasks: sorted,
      openCount: sorted.filter((t) => t.percent < 100).length,
      overlaps,
    }
  })

  people.sort((a, b) => a.name.localeCompare(b.name))
  return { people, unassignedCount }
}
