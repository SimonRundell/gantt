/**
 * Starter templates offered on the home page. Each one builds a fresh
 * project document anchored to the coming Monday, so a student always
 * gets a sensible-looking plan regardless of when they start it.
 * @module lib/templates
 */

import { addCalendarDays, dayOfWeek, todayISO } from './dates.js'
import { generateId } from './id.js'
import { createBlankProject } from './sampleProject.js'

/**
 * Finds the ISO date of the next Monday on or after today.
 * @returns {string} a Monday, `YYYY-MM-DD`
 */
function nextMonday() {
  const today = todayISO()
  const offset = (8 - dayOfWeek(today)) % 7
  return addCalendarDays(today, offset === 0 ? 0 : offset)
}

/**
 * Builds a task record with sensible defaults, so a template only has
 * to specify what actually varies.
 * @param {Partial<import('./scheduler.js').Task>} overrides - fields to override
 * @returns {import('./scheduler.js').Task} a task record
 */
function task(overrides) {
  return {
    id: generateId('t'),
    parentId: null,
    type: 'task',
    name: 'Task',
    start: nextMonday(),
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

/**
 * Builds the Employer Set Project template: a twelve week structure
 * with research, design, build, test and submission phases.
 * @returns {object} a project document
 */
export function createEmployerSetProjectTemplate() {
  const project = createBlankProject('Employer Set Project')
  const start = nextMonday()
  let order = 0

  const research = task({ id: generateId('t'), type: 'group', name: 'Research and planning', start, durationDays: 10, colour: 'blue', order: order++ })
  const t1 = task({ parentId: research.id, name: 'Read the brief and clarify requirements', start, durationDays: 2, colour: 'blue', order: order++ })
  const t2 = task({ parentId: research.id, name: 'Research similar solutions', start, durationDays: 3, colour: 'blue', order: order++ })
  const t3 = task({ parentId: research.id, name: 'Write the project proposal', start, durationDays: 3, colour: 'blue', order: order++ })
  const m1 = task({ parentId: null, type: 'milestone', name: 'Proposal signed off', start, durationDays: 0, colour: 'orange', order: order++ })

  const design = task({ id: generateId('t'), type: 'group', name: 'Design', start, durationDays: 8, colour: 'purple', order: order++ })
  const t4 = task({ parentId: design.id, name: 'Design the user interface', start, durationDays: 3, colour: 'purple', order: order++ })
  const t5 = task({ parentId: design.id, name: 'Plan the data and structure', start, durationDays: 3, colour: 'purple', order: order++ })
  const t6 = task({ parentId: design.id, name: 'Review design with tutor', start, durationDays: 1, colour: 'purple', order: order++ })

  const build = task({ id: generateId('t'), type: 'group', name: 'Build', start, durationDays: 25, colour: 'green', order: order++ })
  const t7 = task({ parentId: build.id, name: 'Set up the project and tools', start, durationDays: 2, colour: 'green', order: order++ })
  const t8 = task({ parentId: build.id, name: 'Build the core functionality', start, durationDays: 10, colour: 'green', order: order++ })
  const t9 = task({ parentId: build.id, name: 'Build the remaining features', start, durationDays: 8, colour: 'green', order: order++ })
  const t10 = task({ parentId: build.id, name: 'Polish and tidy up', start, durationDays: 5, colour: 'green', order: order++ })
  const m2 = task({ parentId: null, type: 'milestone', name: 'Build complete', start, durationDays: 0, colour: 'orange', order: order++ })

  const testPhase = task({ id: generateId('t'), type: 'group', name: 'Testing', start, durationDays: 8, colour: 'teal', order: order++ })
  const t11 = task({ parentId: testPhase.id, name: 'Write and run a test plan', start, durationDays: 3, colour: 'teal', order: order++ })
  const t12 = task({ parentId: testPhase.id, name: 'Fix issues found in testing', start, durationDays: 4, colour: 'teal', order: order++ })
  const t13 = task({ parentId: testPhase.id, name: 'User testing with a classmate', start, durationDays: 1, colour: 'teal', order: order++ })

  const submission = task({ id: generateId('t'), type: 'group', name: 'Submission', start, durationDays: 4, colour: 'red', order: order++ })
  const t14 = task({ parentId: submission.id, name: 'Write the evaluation report', start, durationDays: 3, colour: 'red', order: order++ })
  const t15 = task({ parentId: submission.id, name: 'Submit all evidence', start, durationDays: 1, colour: 'red', order: order++ })
  const m3 = task({ parentId: null, type: 'milestone', name: 'Project submitted', start, durationDays: 0, colour: 'red', order: order++ })

  project.tasks = [
    research, t1, t2, t3, m1,
    design, t4, t5, t6,
    build, t7, t8, t9, t10, m2,
    testPhase, t11, t12, t13,
    submission, t14, t15, m3,
  ]

  const fs = (from, to, lagDays = 0) => ({ id: generateId('d'), from, to, type: 'FS', lagDays })

  project.dependencies = [
    fs(t1.id, t2.id), fs(t2.id, t3.id), fs(t3.id, m1.id),
    fs(m1.id, t4.id), fs(t4.id, t5.id), fs(t5.id, t6.id),
    fs(t6.id, t7.id), fs(t7.id, t8.id), fs(t8.id, t9.id), fs(t9.id, t10.id), fs(t10.id, m2.id),
    fs(m2.id, t11.id), fs(t11.id, t12.id), fs(t12.id, t13.id),
    fs(t13.id, t14.id), fs(t14.id, t15.id), fs(t15.id, m3.id),
  ]

  return project
}

/**
 * Builds the web build sprint plan template: a shorter, two week
 * sprint structure for a small web project.
 * @returns {object} a project document
 */
export function createWebSprintTemplate() {
  const project = createBlankProject('Web build sprint plan')
  const start = nextMonday()
  let order = 0

  const sprint = task({ id: generateId('t'), type: 'group', name: 'Sprint', start, durationDays: 10, colour: 'blue', order: order++ })
  const t1 = task({ parentId: sprint.id, name: 'Sprint planning', start, durationDays: 1, colour: 'blue', order: order++ })
  const t2 = task({ parentId: sprint.id, name: 'Build the homepage', start, durationDays: 2, colour: 'green', order: order++ })
  const t3 = task({ parentId: sprint.id, name: 'Build the content pages', start, durationDays: 3, colour: 'green', order: order++ })
  const t4 = task({ parentId: sprint.id, name: 'Style and responsive layout', start, durationDays: 2, colour: 'purple', order: order++ })
  const t5 = task({ parentId: sprint.id, name: 'Cross-browser testing', start, durationDays: 1, colour: 'teal', order: order++ })
  const review = task({ parentId: null, type: 'milestone', name: 'Sprint review', start, durationDays: 0, colour: 'orange', order: order++ })

  project.tasks = [sprint, t1, t2, t3, t4, t5, review]

  const fs = (from, to) => ({ id: generateId('d'), from, to, type: 'FS', lagDays: 0 })
  project.dependencies = [
    fs(t1.id, t2.id),
    fs(t2.id, t3.id),
    fs(t3.id, t4.id),
    fs(t4.id, t5.id),
    fs(t5.id, review.id),
  ]

  return project
}

/** @type {{id: string, name: string, description: string, build: () => object}[]} every template offered on the home page */
export const TEMPLATES = [
  {
    id: 'esp',
    name: 'Employer Set Project (12 weeks)',
    description: 'Research, design, build, test and submission phases for a twelve week project.',
    build: createEmployerSetProjectTemplate,
  },
  {
    id: 'web-sprint',
    name: 'Web build sprint plan',
    description: 'A short two week sprint plan for a small web build.',
    build: createWebSprintTemplate,
  },
  {
    id: 'blank',
    name: 'Blank',
    description: 'An empty chart to plan from scratch.',
    build: () => createBlankProject('Untitled project'),
  },
]
