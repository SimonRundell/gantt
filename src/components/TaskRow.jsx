import { formatUKDate } from '../lib/dates.js'
import { computeEnd } from '../lib/scheduler.js'

/**
 * One row of the task table: the name cell (with indent, expand
 * toggle and type marker) plus whichever other columns the view asks
 * for.
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
}) {
  const end = computeEnd(task, calendar)

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
        return task.type === 'group' ? `${task.percent}%` : (
          <span className="task-row__percent">
            {task.percent}%{task.percent >= 100 ? <span aria-hidden="true"> ✓</span> : null}
          </span>
        )
      case 'assignee':
        return task.assignee || ''
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
        <span className={`task-row__type-marker task-row__type-marker--${task.type}`} aria-hidden="true" />
        <span className="task-row__name">{task.name}</span>
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
