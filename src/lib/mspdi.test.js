import { describe, expect, it } from 'vitest'
import { DEFAULT_CALENDAR } from './calendar.js'
import { mspdiToNewProject, parseMspdiXml, tasksToMspdiXml } from './mspdi.js'

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
    durationDays: 1,
    percent: 0,
    assignee: '',
    colour: 'blue',
    notes: '',
    collapsed: false,
    order: 0,
    baseline: null,
    comments: [],
    ...overrides,
  }
}

/**
 * Parses XML text for assertions in the export tests.
 * @param {string} xml - the XML document text
 * @returns {Document} the parsed document
 */
function parseXml(xml) {
  return new DOMParser().parseFromString(xml, 'application/xml')
}

describe('tasksToMspdiXml', () => {
  it('writes one Task element per task, in outline order, with the right OutlineLevel', () => {
    const project = {
      title: 'Sample',
      calendar: DEFAULT_CALENDAR,
      tasks: [
        task({ id: 'g1', type: 'group', name: 'Phase one' }),
        task({ id: 'c1', parentId: 'g1', name: 'Child task' }),
      ],
      dependencies: [],
    }

    const xml = tasksToMspdiXml(project)
    const doc = parseXml(xml)
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)

    const tasks = Array.from(doc.getElementsByTagName('Task'))
    expect(tasks).toHaveLength(2)
    expect(tasks[0].getElementsByTagName('Name')[0].textContent).toBe('Phase one')
    expect(tasks[0].getElementsByTagName('OutlineLevel')[0].textContent).toBe('1')
    expect(tasks[0].getElementsByTagName('Summary')[0].textContent).toBe('1')
    expect(tasks[1].getElementsByTagName('Name')[0].textContent).toBe('Child task')
    expect(tasks[1].getElementsByTagName('OutlineLevel')[0].textContent).toBe('2')
    expect(tasks[1].getElementsByTagName('Summary')[0].textContent).toBe('0')
  })

  it('writes a milestone with zero duration and the Milestone flag set', () => {
    const project = {
      title: 'Sample',
      calendar: DEFAULT_CALENDAR,
      tasks: [task({ id: 't1', type: 'milestone', name: 'Signed off', durationDays: 0 })],
      dependencies: [],
    }

    const xml = tasksToMspdiXml(project)
    const taskEl = parseXml(xml).getElementsByTagName('Task')[0]
    expect(taskEl.getElementsByTagName('Milestone')[0].textContent).toBe('1')
    expect(taskEl.getElementsByTagName('Duration')[0].textContent).toBe('PT0H0M0S')
  })

  it('writes a PredecessorLink with the right MSPDI type number and lag in tenths of a day', () => {
    const project = {
      title: 'Sample',
      calendar: DEFAULT_CALENDAR,
      tasks: [task({ id: 't1', name: 'First' }), task({ id: 't2', name: 'Second' })],
      dependencies: [{ id: 'd1', from: 't1', to: 't2', type: 'SS', lagDays: 2 }],
    }

    const xml = tasksToMspdiXml(project)
    const secondTask = parseXml(xml).getElementsByTagName('Task')[1]
    const link = secondTask.getElementsByTagName('PredecessorLink')[0]
    expect(link.getElementsByTagName('PredecessorUID')[0].textContent).toBe('1')
    expect(link.getElementsByTagName('Type')[0].textContent).toBe('3') // SS
    expect(link.getElementsByTagName('LinkLag')[0].textContent).toBe('20') // 2 days = 20 tenths
  })

  it('escapes special characters in the task name', () => {
    const project = {
      title: 'Sample',
      calendar: DEFAULT_CALENDAR,
      tasks: [task({ id: 't1', name: 'Fish & chips <review>' })],
      dependencies: [],
    }

    const xml = tasksToMspdiXml(project)
    const doc = parseXml(xml)
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    expect(doc.getElementsByTagName('Task')[0].getElementsByTagName('Name')[0].textContent).toBe('Fish & chips <review>')
  })
})

describe('parseMspdiXml', () => {
  it('reads tasks, hierarchy and predecessors from a hand-written file (not our own writer)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <Project xmlns="http://schemas.microsoft.com/project">
        <Tasks>
          <Task>
            <UID>0</UID>
            <Name>Project Summary</Name>
            <OutlineLevel>0</OutlineLevel>
            <Summary>1</Summary>
          </Task>
          <Task>
            <UID>1</UID>
            <ID>1</ID>
            <Name>Design</Name>
            <OutlineLevel>1</OutlineLevel>
            <Start>2026-10-05T08:00:00</Start>
            <Finish>2026-10-07T17:00:00</Finish>
            <Duration>PT24H0M0S</Duration>
            <PercentComplete>50</PercentComplete>
            <Milestone>0</Milestone>
            <Summary>0</Summary>
          </Task>
          <Task>
            <UID>2</UID>
            <ID>2</ID>
            <Name>Build</Name>
            <OutlineLevel>1</OutlineLevel>
            <Start>2026-10-08T08:00:00</Start>
            <Finish>2026-10-10T17:00:00</Finish>
            <Duration>PT24H0M0S</Duration>
            <PercentComplete>0</PercentComplete>
            <Milestone>0</Milestone>
            <Summary>0</Summary>
            <PredecessorLink>
              <PredecessorUID>1</PredecessorUID>
              <Type>1</Type>
              <LinkLag>0</LinkLag>
              <LagFormat>7</LagFormat>
            </PredecessorLink>
          </Task>
        </Tasks>
      </Project>`

    const result = parseMspdiXml(xml, { defaultStart: START })
    expect(result.errors).toEqual([])
    expect(result.tasks).toHaveLength(2) // the UID 0 project summary is skipped
    expect(result.tasks.map((t) => t.name)).toEqual(['Design', 'Build'])
    expect(result.tasks[0].durationDays).toBe(3) // 24 hours / 8 hours-per-day
    expect(result.tasks[0].percent).toBe(50)
    expect(result.tasks[0].start).toBe('2026-10-05')
    expect(result.dependencies).toHaveLength(1)
    expect(result.dependencies[0].type).toBe('FS')
    expect(result.dependencies[0].lagDays).toBe(0)
  })

  it('builds parentId from OutlineLevel and turns a task with children into a group', () => {
    const xml = `<Project xmlns="http://schemas.microsoft.com/project"><Tasks>
      <Task><UID>1</UID><Name>Phase one</Name><OutlineLevel>1</OutlineLevel><Start>2026-10-05T08:00:00</Start><Duration>PT8H0M0S</Duration></Task>
      <Task><UID>2</UID><Name>Child task</Name><OutlineLevel>2</OutlineLevel><Start>2026-10-05T08:00:00</Start><Duration>PT8H0M0S</Duration></Task>
    </Tasks></Project>`

    const result = parseMspdiXml(xml, { defaultStart: START })
    expect(result.tasks[0].type).toBe('group')
    expect(result.tasks[1].parentId).toBe(result.tasks[0].id)
  })

  it('rejects a file that is not well-formed XML', () => {
    const result = parseMspdiXml('<Project><Tasks><Task>', { defaultStart: START })
    expect(result.errors).toHaveLength(1)
  })

  it('rejects a file with no Task elements', () => {
    const result = parseMspdiXml('<Project xmlns="http://schemas.microsoft.com/project"><Tasks/></Project>', {
      defaultStart: START,
    })
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('warns about and defaults an unreadable duration rather than failing the whole import', () => {
    const xml = `<Project xmlns="http://schemas.microsoft.com/project"><Tasks>
      <Task><UID>1</UID><Name>Odd task</Name><OutlineLevel>1</OutlineLevel><Start>2026-10-05T08:00:00</Start><Duration>not-a-duration</Duration></Task>
    </Tasks></Project>`

    const result = parseMspdiXml(xml, { defaultStart: START })
    expect(result.errors).toEqual([])
    expect(result.tasks[0].durationDays).toBe(1)
    expect(result.warnings.some((w) => w.includes('duration'))).toBe(true)
  })

  it('rejects predecessors that form a circular chain', () => {
    const xml = `<Project xmlns="http://schemas.microsoft.com/project"><Tasks>
      <Task><UID>1</UID><Name>A</Name><OutlineLevel>1</OutlineLevel><Start>2026-10-05T08:00:00</Start><Duration>PT8H0M0S</Duration>
        <PredecessorLink><PredecessorUID>2</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink>
      </Task>
      <Task><UID>2</UID><Name>B</Name><OutlineLevel>1</OutlineLevel><Start>2026-10-05T08:00:00</Start><Duration>PT8H0M0S</Duration>
        <PredecessorLink><PredecessorUID>1</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink>
      </Task>
    </Tasks></Project>`

    const result = parseMspdiXml(xml, { defaultStart: START })
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('export/import round trip', () => {
  it('reconstructs names, hierarchy, dates, duration, percent and predecessors (type and lag) after exporting and re-importing', () => {
    const project = {
      title: 'Round trip',
      calendar: DEFAULT_CALENDAR,
      tasks: [
        task({ id: 'g1', type: 'group', name: 'Research' }),
        task({ id: 'c1', parentId: 'g1', name: 'Read the brief', start: '2026-10-05', durationDays: 2, percent: 40 }),
        task({ id: 'c2', parentId: 'g1', name: 'Write it up', start: '2026-10-07', durationDays: 3, percent: 0 }),
        task({ id: 'm1', type: 'milestone', name: 'Signed off', start: '2026-10-10', durationDays: 0 }),
      ],
      dependencies: [{ id: 'd1', from: 'c1', to: 'c2', type: 'FS', lagDays: 1 }],
    }

    const xml = tasksToMspdiXml(project)
    const result = parseMspdiXml(xml, { defaultStart: START })

    expect(result.errors).toEqual([])
    expect(result.tasks.map((t) => t.name)).toEqual(['Research', 'Read the brief', 'Write it up', 'Signed off'])
    expect(result.tasks.map((t) => t.type)).toEqual(['group', 'task', 'task', 'milestone'])
    expect(result.tasks[1].start).toBe('2026-10-05')
    expect(result.tasks[1].durationDays).toBe(2)
    expect(result.tasks[1].percent).toBe(40)
    expect(result.tasks[2].parentId).toBe(result.tasks[0].id)

    expect(result.dependencies).toHaveLength(1)
    expect(result.dependencies[0].type).toBe('FS')
    expect(result.dependencies[0].lagDays).toBe(1)
    expect(result.dependencies[0].to).toBe(result.tasks[2].id)
  })
})

describe('mspdiToNewProject', () => {
  it('builds a scheduled project from a file, titled from the filename', () => {
    const xml = `<Project xmlns="http://schemas.microsoft.com/project"><Tasks>
      <Task><UID>1</UID><Name>Kick off</Name><OutlineLevel>1</OutlineLevel><Start>2026-10-05T08:00:00</Start><Duration>PT8H0M0S</Duration></Task>
    </Tasks></Project>`

    const { project, errors } = mspdiToNewProject(xml, 'my_plan.xml', START)
    expect(errors).toEqual([])
    expect(project.title).toBe('my plan')
    expect(project.tasks).toHaveLength(1)
    expect(project.tasks[0].name).toBe('Kick off')
  })

  it('returns no project and the reasons when the file cannot be used', () => {
    const { project, errors } = mspdiToNewProject('not xml at all <', 'broken.xml', START)
    expect(project).toBeNull()
    expect(errors.length).toBeGreaterThan(0)
  })
})
