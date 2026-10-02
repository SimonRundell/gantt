import { useRef, useState } from 'react'
import { TASK_COLOURS } from '../lib/constants.js'
import { formatUKDate } from '../lib/dates.js'
import { computeEnd } from '../lib/scheduler.js'
import { baselineVarianceDays, formatVariance } from '../lib/baseline.js'
import { parseTaskField } from '../lib/taskFields.js'
import EditableCell from './EditableCell.jsx'

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
 * @param {(taskId: string, fields: object) => void} props.onFieldChange - called when the start, duration or percent is edited and committed
 * @param {boolean} [props.readOnly] - when true, the name, assignee and colour are not editable
 * @param {'before'|'after'|'inside'|null} [props.dropPosition] - where a row being dragged would land relative to this one, for the drop indicator
 * @param {boolean} [props.dragging] - whether this row is the one being dragged
 * @param {(event: import('react').DragEvent, task: import('../lib/scheduler.js').Task, row: HTMLElement) => void} [props.onGripDragStart] - called when the drag handle is picked up; the handle is only shown when this is given
 * @param {(event: import('react').DragEvent, task: import('../lib/scheduler.js').Task) => void} [props.onRowDragOver] - called as a dragged row moves over this one
 * @param {(event: import('react').DragEvent, task: import('../lib/scheduler.js').Task) => void} [props.onRowDrop] - called when a dragged row is dropped on this one
 * @param {() => void} [props.onGripDragEnd] - called when a drag finishes or is cancelled
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
  onFieldChange,
  readOnly,
  dropPosition,
  dragging,
  onGripDragStart,
  onRowDragOver,
  onRowDrop,
  onGripDragEnd,
}) {
  const end = computeEnd(task, calendar)
  const varianceLabel = formatVariance(baselineVarianceDays(task, calendar))
  const [editingName, setEditingName] = useState(false)
  const rowRef = useRef(null)

  /**
   * Applies a value typed into the start, duration or percent cell,
   * ignoring anything that is not a usable value.
   * @param {'start'|'durationDays'|'percent'} field - which field was edited
   * @param {string} text - the typed text
   * @returns {void}
   */
  function commitField(field, text) {
    const fields = parseTaskField(field, text)
    if (fields) onFieldChange(task.id, fields)
  }

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
    const isGroup = task.type === 'group'
    const isMilestone = task.type === 'milestone'

    switch (column) {
      case 'start':
        return (
          <EditableCell
            display={formatUKDate(task.start)}
            value={task.start}
            valueText={formatUKDate(task.start)}
            inputType="date"
            label={`Start date for ${task.name}`}
            disabled={readOnly || isGroup}
            onCommit={(text) => commitField('start', text)}
          />
        )
      case 'end':
        return formatUKDate(end)
      case 'duration':
        return isMilestone ? (
          '-'
        ) : (
          <EditableCell
            display={`${task.durationDays}d`}
            value={String(task.durationDays)}
            valueText={`${task.durationDays} working days`}
            inputType="number"
            min={1}
            label={`Duration for ${task.name}`}
            disabled={readOnly || isGroup}
            onCommit={(text) => commitField('durationDays', text)}
          />
        )
      case 'percent':
        return (
          <EditableCell
            display={
              <span className="task-row__percent">
                {task.percent}%{task.percent >= 100 ? <span aria-hidden="true"> ✓</span> : null}
              </span>
            }
            value={String(task.percent)}
            valueText={`${task.percent}%`}
            inputType="number"
            min={0}
            max={100}
            label={`Percent complete for ${task.name}`}
            disabled={readOnly || isGroup}
            onCommit={(text) => commitField('percent', text)}
          />
        )
      case 'assignee':
        return (
          <EditableCell
            display={task.assignee || ''}
            value={task.assignee}
            valueText={task.assignee || 'none'}
            label={`Assignee for ${task.name}`}
            disabled={readOnly}
            onCommit={(text) => onAssigneeChange(task.id, text)}
          />
        )
      case 'predecessors':
        return (predecessorsByTask.get(task.id) ?? [])
          .map((dep) => tasksById.get(dep.from)?.name ?? dep.from)
          .join(', ')
      case 'notes':
        return task.notes || ''
      case 'variance':
        return varianceLabel
      default:
        return null
    }
  }

  return (
    <div
      ref={rowRef}
      className={`task-row${selected ? ' task-row--selected' : ''} task-row--${task.type}${
        dragging ? ' task-row--dragging' : ''
      }${dropPosition ? ` task-row--drop-${dropPosition}` : ''}`}
      role="row"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect(task.id)}
      onDragOver={onRowDragOver ? (event) => onRowDragOver(event, task) : undefined}
      onDrop={onRowDrop ? (event) => onRowDrop(event, task) : undefined}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'F2' || (event.key === 'Enter' && selected)) {
          event.preventDefault()
          if (!readOnly) setEditingName(true)
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(task.id)
        }
      }}
    >
      {onGripDragStart && (
        <span
          className="task-row__grip"
          draggable
          title="Drag to reorder"
          aria-hidden="true"
          onDragStart={(event) => onGripDragStart(event, task, rowRef.current)}
          onDragEnd={onGripDragEnd}
        >
          &#8942;&#8942;
        </span>
      )}
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
            onFocus={(event) => event.target.select()}
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
