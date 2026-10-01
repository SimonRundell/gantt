/**
 * Local project fixtures used while the editor is built out and for
 * performance testing with a larger task count. The actual starter
 * templates offered on the home page live in `lib/templates.js`.
 * @module lib/sampleProject
 */

import { addCalendarDays } from './dates.js'
import { generateId } from './id.js'

/**
 * Builds the default working calendar: Monday to Friday, no holidays.
 * @returns {import('./calendar.js').WorkingCalendar} a fresh default calendar
 */
export function createDefaultCalendar() {
  return { workingDays: [1, 2, 3, 4, 5], nonWorkingDates: [], weekStartsOn: 1 }
}

/**
 * Builds the default view settings for a new project.
 * @returns {object} a fresh default view state
 */
export function createDefaultView() {
  return {
    zoom: 'week',
    showCriticalPath: false,
    showBaseline: false,
    columns: ['name', 'start', 'end', 'duration', 'percent', 'assignee'],
  }
}

/**
 * Builds a completely empty project with no tasks, ready for a
 * student to start planning from scratch.
 * @param {string} [title] - the project title
 * @returns {object} a blank project document
 */
export function createBlankProject(title = 'Untitled project') {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    id: null,
    title,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    calendar: createDefaultCalendar(),
    view: createDefaultView(),
    tasks: [],
    dependencies: [],
  }
}

/**
 * Builds a small example project with a group, ordinary tasks, a
 * milestone and a dependency, so the editor has something meaningful
 * to show before a student has typed anything.
 * @returns {object} a small starter project document
 */
export function createStarterProject() {
  const project = createBlankProject('Example project')
  const groupId = generateId('t')
  const t1 = generateId('t')
  const t2 = generateId('t')
  const milestoneId = generateId('t')
  const start = '2026-10-05'

  project.tasks = [
    {
      id: groupId,
      parentId: null,
      type: 'group',
      name: 'Planning',
      start,
      durationDays: 5,
      percent: 0,
      assignee: '',
      colour: 'blue',
      notes: '',
      collapsed: false,
      order: 0,
      baseline: null,
    },
    {
      id: t1,
      parentId: groupId,
      type: 'task',
      name: 'Write requirements',
      start,
      durationDays: 2,
      percent: 50,
      assignee: '',
      colour: 'green',
      notes: '',
      collapsed: false,
      order: 1,
      baseline: null,
    },
    {
      id: t2,
      parentId: groupId,
      type: 'task',
      name: 'Review with tutor',
      start,
      durationDays: 1,
      percent: 0,
      assignee: '',
      colour: 'teal',
      notes: '',
      collapsed: false,
      order: 2,
      baseline: null,
    },
    {
      id: milestoneId,
      parentId: null,
      type: 'milestone',
      name: 'Requirements signed off',
      start,
      durationDays: 0,
      percent: 0,
      assignee: '',
      colour: 'orange',
      notes: '',
      collapsed: false,
      order: 3,
      baseline: null,
    },
  ]

  project.dependencies = [
    { id: generateId('d'), from: t1, to: t2, type: 'FS', lagDays: 0 },
    { id: generateId('d'), from: t2, to: milestoneId, type: 'FS', lagDays: 0 },
  ]

  return project
}

/**
 * Builds a larger generated project, used to check the editor stays
 * responsive with a realistic number of tasks.
 * @param {number} [groupCount] - how many top-level groups to create
 * @param {number} [tasksPerGroup] - how many child tasks per group
 * @returns {object} a generated project document with many tasks
 */
export function createPerformanceSampleProject(groupCount = 10, tasksPerGroup = 10) {
  const project = createBlankProject('Performance sample')
  const tasks = []
  let order = 0
  let cursor = '2026-10-05'

  for (let g = 0; g < groupCount; g++) {
    const groupId = generateId('t')
    tasks.push({
      id: groupId,
      parentId: null,
      type: 'group',
      name: `Group ${g + 1}`,
      start: cursor,
      durationDays: tasksPerGroup,
      percent: 0,
      assignee: '',
      colour: ['blue', 'green', 'purple', 'teal'][g % 4],
      notes: '',
      collapsed: false,
      order: order++,
      baseline: null,
    })

    for (let i = 0; i < tasksPerGroup; i++) {
      tasks.push({
        id: generateId('t'),
        parentId: groupId,
        type: 'task',
        name: `Task ${g + 1}.${i + 1}`,
        start: cursor,
        durationDays: 1 + (i % 3),
        percent: (i * 10) % 110 > 100 ? 100 : (i * 10) % 110,
        assignee: ['', 'Sam', 'Priya', 'Jordan'][i % 4],
        colour: ['blue', 'green', 'purple', 'teal', 'orange', 'red', 'yellow', 'grey'][i % 8],
        notes: '',
        collapsed: false,
        order: order++,
        baseline: null,
      })
      cursor = addCalendarDays(cursor, 1 + (i % 3))
    }

    cursor = addCalendarDays(cursor, 2)
  }

  project.tasks = tasks
  return project
}
