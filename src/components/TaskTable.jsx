import { useEffect, useRef } from 'react'
import { COLUMN_LABELS, ROW_HEIGHT } from '../lib/constants.js'
import { useElementSize } from '../hooks/useElementSize.js'
import { useRowWindow } from '../hooks/useRowWindow.js'
import TaskRow from './TaskRow.jsx'

/**
 * The task table on the left of the editor: a sticky header, a
 * resizable set of columns, and windowed rows so the table stays
 * responsive with hundreds of tasks.
 * @param {object} props
 * @param {{task: import('../lib/scheduler.js').Task, depth: number, hasChildren: boolean}[]} props.rows - the visible rows, already flattened and ordered
 * @param {string[]} props.columns - which columns to show, in order
 * @param {string|null} props.selectedTaskId - the currently selected task's id
 * @param {import('../lib/calendar.js').WorkingCalendar} props.calendar - the project's working calendar
 * @param {Map<string, import('../lib/scheduler.js').Dependency[]>} props.predecessorsByTask - dependency edges keyed by successor id
 * @param {Map<string, import('../lib/scheduler.js').Task>} props.tasksById - every task keyed by id
 * @param {(taskId: string) => void} props.onSelect - called when a row is selected
 * @param {(taskId: string) => void} props.onToggleCollapse - called when a row's disclosure arrow is used
 * @param {number} props.scrollTop - the vertical scroll offset to apply, kept in sync with the timeline
 * @param {(scrollTop: number) => void} props.onScroll - called when the table is scrolled vertically
 * @returns {JSX.Element} the task table pane
 */
function TaskTable({
  rows,
  columns,
  selectedTaskId,
  calendar,
  predecessorsByTask,
  tasksById,
  onSelect,
  onToggleCollapse,
  scrollTop,
  onScroll,
}) {
  const bodyRef = useRef(null)
  const { height: viewportHeight } = useElementSize(bodyRef)

  useEffect(() => {
    if (bodyRef.current && bodyRef.current.scrollTop !== scrollTop) {
      bodyRef.current.scrollTop = scrollTop
    }
  }, [scrollTop])

  const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } = useRowWindow(
    scrollTop,
    viewportHeight,
    rows.length,
    ROW_HEIGHT,
  )
  const visibleRows = rows.slice(startIndex, endIndex)
  // The name column always has its own dedicated cell (with the indent,
  // disclosure arrow and type marker), so it is never repeated here even
  // if a project's view.columns list happens to include it.
  const extraColumns = columns.filter((column) => column !== 'name')

  return (
    <div className="task-table" style={{ '--row-height': `${ROW_HEIGHT}px` }}>
      <div className="task-table__header" role="row">
        <div className="task-table__header-cell task-table__header-cell--name">Name</div>
        {extraColumns.map((column) => (
          <div key={column} className="task-table__header-cell">
            {COLUMN_LABELS[column] ?? column}
          </div>
        ))}
      </div>
      <div
        className="task-table__body"
        role="rowgroup"
        ref={bodyRef}
        onScroll={(event) => onScroll(event.currentTarget.scrollTop)}
      >
        <div style={{ height: topSpacerHeight }} aria-hidden="true" />
        {visibleRows.map(({ task, depth, hasChildren }) => (
          <TaskRow
            key={task.id}
            task={task}
            depth={depth}
            hasChildren={hasChildren}
            columns={extraColumns}
            selected={task.id === selectedTaskId}
            calendar={calendar}
            predecessorsByTask={predecessorsByTask}
            tasksById={tasksById}
            onSelect={onSelect}
            onToggleCollapse={onToggleCollapse}
          />
        ))}
        <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
        {rows.length === 0 && (
          <p className="task-table__empty">No tasks yet. Use "Add task" in the toolbar to start planning.</p>
        )}
      </div>
    </div>
  )
}

export default TaskTable
