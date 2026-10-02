import { useState } from 'react'
import { TASK_COLOURS } from '../lib/constants.js'
import { formatUKDate } from '../lib/dates.js'
import { computeEnd } from '../lib/scheduler.js'

/**
 * One row of the task table: the name cell (with indent, expand
 * toggle, colour swatch and type marker) plus whichever other columns
 * the view asks for. The name and assignee cells are editable inline.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Task} props.task - the task to display
 * @param {number} props.depth - how many levels deep this task is nested
 * @param {boolean} props.hasChildren - whether this task has children to expand/collapse
 * @param {string[]} props.columns - which columns to render, in order
 * @param {boolean} props.selected - whether this row is currently selected
 * @param {import('../lib/calendar.js').WorkingCalendar} props.calendar - the project's working calendar
 * @param {Map<string, import('../lib/scheduler.js').Dependency[]>} props.predecessorsByTask - dependency edges keyed by successor id
 * @param {Map<string, import('../lib/scheduler.js').Task>} props.tasksById - every task keyed by id, for predecessor names
 * @param {(taskId: string) => void} props.onSelect - called when the row is clicked
 * @param {(taskId: string) => void} props.onToggleCollapse - called when the expand/collapse arrow is clicked
 * @param {(taskId: string, name: string) => void} props.onRename - called when the task's name is edited and committed
 * @param {(taskId: string, assignee: string) => void} props.onAssigneeChange - called when the task's assignee is edited and committed
 * @param {(taskId: string, colour: string) => void} props.onColourChange - called when the colour swatch is clicked, cycling to the next colour
 * @param {boolean} [props.readOnly] - when true, the name, assignee and colour are not editable
 * @returns {JSX.Element} the table row
 */
function TaskRow({
  task,
  depth,
  hasChildren,
  columns,
  selected,
  calendar,
  predecessorsByTask,
  tasksById,
  onSelect,
  onToggleCollapse,
  onRename,
  onAssigneeChange,
  onColourChange,
  readOnly,
}) {
  const end = computeEnd(task, calendar)
  const [editingName, setEditingName] = useState(false)
  const [editingAssignee, setEditingAssignee] = useState(false)

  /**
   * Cycles the task's colour to the next one in the fixed palette.
   * @param {import('react').MouseEvent} event - the click event
   * @returns {void}
   */
  function handleSwatchClick(event) {
    event.stopPropagation()
    if (readOnly) return
    const index = TASK_COLOURS.findIndex((c) => c.value === task.colour)
    const next = TASK_COLOURS[(index + 1) % TASK_COLOURS.length]
    onColourChange(task.id, next.value)
  }

  /**
   * Renders the content for one column cell.
   * @param {string} column - the column id
   * @returns {JSX.Element|string|null} the cell content
   */
  function renderCell(column) {
    switch (column) {
      case 'start':
        return formatUKDate(task.start)
      case 'end':
        return formatUKDate(end)
      case 'duration':
        return task.type === 'milestone' ? '-' : `${task.durationDays}d`
      case 'percent':
        return task.type === 'group' ? (
          `${task.percent}%`
        ) : (
          <span className="task-row__percent">
            {task.percent}%{task.percent >= 100 ? <span aria-hidden="true"> ✓</span> : null}
          </span>
        )
      case 'assignee':
        return editingAssignee ? (
          <input
            className="task-row__edit-input"
            autoFocus
            defaultValue={task.assignee}
            aria-label={`Assignee for ${task.name}`}
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => {
              onAssigneeChange(task.id, event.target.value)
              setEditingAssignee(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') setEditingAssignee(false)
            }}
          />
        ) : (
          <button
            type="button"
            className="task-row__cell-button"
            disabled={readOnly}
            aria-label={`Assignee for ${task.name}: ${task.assignee || 'none'}, click to edit`}
            onClick={(event) => {
              event.stopPropagation()
              setEditingAssignee(true)
            }}
          >
            {task.assignee || ''}
          </button>
        )
      case 'predecessors':
        return (predecessorsByTask.get(task.id) ?? [])
          .map((dep) => tasksById.get(dep.from)?.name ?? dep.from)
          .join(', ')
      case 'notes':
        return task.notes || ''
      default:
        return null
    }
  }

  return (
    <div
      className={`task-row${selected ? ' task-row--selected' : ''} task-row--${task.type}`}
      role="row"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect(task.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(task.id)
        }
      }}
    >
      <div className="task-row__cell task-row__cell--name" style={{ paddingLeft: `${depth * 18 + 8}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className="task-row__disclosure"
            aria-label={task.collapsed ? `Expand ${task.name}` : `Collapse ${task.name}`}
            aria-expanded={!task.collapsed}
            onClick={(event) => {
              event.stopPropagation()
              onToggleCollapse(task.id)
            }}
          >
            {task.collapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="task-row__disclosure task-row__disclosure--spacer" aria-hidden="true" />
        )}
        <button
          type="button"
          className={`task-row__type-marker task-row__type-marker--${task.type} task-row__type-marker--${task.colour}`}
          aria-label={`Change colour for ${task.name}, currently ${task.colour}`}
          onClick={handleSwatchClick}
        />
        {editingName ? (
          <input
            className="task-row__edit-input"
            autoFocus
            defaultValue={task.name}
            aria-label="Task name"
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => {
              const value = event.target.value.trim()
              if (value !== '') onRename(task.id, value)
              setEditingName(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') setEditingName(false)
            }}
          />
        ) : (
          <span
            className="task-row__name"
            onDoubleClick={(event) => {
              event.stopPropagation()
              if (!readOnly) setEditingName(true)
            }}
          >
            {task.name}
          </span>
        )}
      </div>
      {columns.map((column) => (
        <div key={column} className={`task-row__cell task-row__cell--${column}`}>
          {renderCell(column)}
        </div>
      ))}
    </div>
  )
}

export default TaskRow
