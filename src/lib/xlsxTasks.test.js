import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { DEFAULT_CALENDAR } from './calendar.js'
import { buildTasksWorkbook, tasksToXlsxBuffer } from './xlsxTasks.js'

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

describe('buildTasksWorkbook', () => {
  it('writes one row per task, with a bold header and the right headings', () => {
    const project = {
      title: 'Sample',
      calendar: DEFAULT_CALENDAR,
      tasks: [
        task({ id: 'g1', type: 'group', name: 'Phase one', parentId: null }),
        task({ id: 't1', name: 'Write the report', parentId: 'g1', percent: 40, assignee: 'Sam' }),
      ],
      dependencies: [],
    }

    const workbook = buildTasksWorkbook(project)
    const sheet = workbook.getWorksheet('Tasks')

    expect(sheet.getRow(1).values.slice(1)).toEqual([
      'Name',
      'Type',
      'Start',
      'End',
      'Duration (working days)',
      'Percent complete',
      'Assignee',
      'Colour',
      'Notes',
      'Predecessors',
    ])
    expect(sheet.getRow(1).font.bold).toBe(true)
    expect(sheet.rowCount).toBe(3)

    const taskRow = sheet.getRow(3)
    expect(taskRow.getCell('name').value).toBe('Write the report')
    expect(taskRow.getCell('percent').value).toBe(40)
    expect(taskRow.getCell('assignee').value).toBe('Sam')
  })

  it('indents a child task one level deeper than its parent group', () => {
    const project = {
      title: 'Sample',
      calendar: DEFAULT_CALENDAR,
      tasks: [
        task({ id: 'g1', type: 'group', name: 'Phase one', parentId: null }),
        task({ id: 't1', name: 'Child task', parentId: 'g1' }),
      ],
      dependencies: [],
    }

    const sheet = buildTasksWorkbook(project).getWorksheet('Tasks')
    expect(sheet.getRow(2).getCell('name').alignment.indent).toBe(0)
    expect(sheet.getRow(3).getCell('name').alignment.indent).toBe(1)
  })

  it('renders a predecessor as a row-number reference with its type and lag', () => {
    const project = {
      title: 'Sample',
      calendar: DEFAULT_CALENDAR,
      tasks: [
        task({ id: 't1', name: 'First' }),
        task({ id: 't2', name: 'Second', parentId: null }),
      ],
      dependencies: [{ id: 'd1', from: 't1', to: 't2', type: 'FS', lagDays: 2 }],
    }

    const sheet = buildTasksWorkbook(project).getWorksheet('Tasks')
    expect(sheet.getRow(3).getCell('predecessors').value).toBe('1FS+2')
  })
})

describe('tasksToXlsxBuffer', () => {
  it('produces a buffer that reads back as a valid workbook', async () => {
    const project = {
      title: 'Sample',
      calendar: DEFAULT_CALENDAR,
      tasks: [task({ id: 't1', name: 'Only task' })],
      dependencies: [],
    }

    const buffer = await tasksToXlsxBuffer(project)
    expect(buffer.byteLength).toBeGreaterThan(0)

    const roundTripped = new ExcelJS.Workbook()
    await roundTripped.xlsx.load(buffer)
    // A column's `key` is an ExcelJS-only convenience that is not
    // stored in the file itself, so a freshly loaded sheet has to be
    // read back by position instead.
    expect(roundTripped.getWorksheet('Tasks').getRow(2).getCell(1).value).toBe('Only task')
  })
})
