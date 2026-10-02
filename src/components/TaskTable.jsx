import { useEffect, useRef, useState } from 'react'
import { dropPositionFromOffset } from '../lib/dragReorder.js'
import { collectSubtreeIds } from '../lib/taskTree.js'
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
 * @param {(taskId: string, name: string) => void} props.onRename - called when a task's name is edited and committed
 * @param {(taskId: string, assignee: string) => void} props.onAssigneeChange - called when a task's assignee is edited and committed
 * @param {(taskId: string, colour: string) => void} props.onColourChange - called when a task's colour swatch is clicked
 * @param {(taskId: string, fields: object) => void} props.onFieldChange - called when a task's start, duration or percent is edited
 * @param {(taskId: string, targetId: string, position: 'before'|'after'|'inside') => void} props.onMoveTask - called when a row is dragged to a new place
 * @param {boolean} [props.readOnly] - when true, disables inline editing and dragging
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
  onRename,
  onAssigneeChange,
  onColourChange,
  onFieldChange,
  onMoveTask,
  readOnly,
  scrollTop,
  onScroll,
}) {
  const bodyRef = useRef(null)
  // Row drag and drop: which task is being dragged (and the ids it may
  // not be dropped onto, being its own subtree), and where it would land.
  const dragRef = useRef(null)
  const [draggingId, setDraggingId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
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

  /**
   * Starts dragging a row by its handle, remembering which rows it
   * cannot be dropped onto (itself and anything inside it).
   * @param {import('react').DragEvent} event - the drag start event
   * @param {import('../lib/scheduler.js').Task} task - the task being dragged
   * @param {HTMLElement} rowElement - the row, used as the drag image
   * @returns {void}
   */
  function handleGripDragStart(event, task, rowElement) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
    if (rowElement) event.dataTransfer.setDragImage(rowElement, 16, ROW_HEIGHT / 2)
    dragRef.current = { id: task.id, blocked: new Set(collectSubtreeIds([...tasksById.values()], task.id)) }
    setDraggingId(task.id)
  }

  /**
   * Works out where the dragged row would land as it moves over a row,
   * and shows an indicator. Rows it may not be dropped on get none.
   * @param {import('react').DragEvent} event - the drag over event
   * @param {import('../lib/scheduler.js').Task} task - the row being hovered
   * @returns {void}
   */
  function handleRowDragOver(event, task) {
    const drag = dragRef.current
    if (!drag) return
    if (drag.blocked.has(task.id)) {
      if (dropTarget) setDropTarget(null)
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const box = event.currentTarget.getBoundingClientRect()
    const position = dropPositionFromOffset(event.clientY - box.top, box.height, task.type === 'group')
    if (!dropTarget || dropTarget.id !== task.id || dropTarget.position !== position) {
      setDropTarget({ id: task.id, position })
    }
  }

  /**
   * Finishes a drag: asks for the move if the row was dropped on a
   * valid place, then clears the drag state.
   * @param {import('react').DragEvent} event - the drop event
   * @param {import('../lib/scheduler.js').Task} task - the row it was dropped on
   * @returns {void}
   */
  function handleRowDrop(event, task) {
    const drag = dragRef.current
    if (!drag || drag.blocked.has(task.id)) return
    event.preventDefault()
    const box = event.currentTarget.getBoundingClientRect()
    const position = dropPositionFromOffset(event.clientY - box.top, box.height, task.type === 'group')
    onMoveTask(drag.id, task.id, position)
    handleGripDragEnd()
  }

  /**
   * Clears the drag state when a drag ends, whether dropped or cancelled.
   * @returns {void}
   */
  function handleGripDragEnd() {
    dragRef.current = null
    setDraggingId(null)
    setDropTarget(null)
  }
  // The name column always has its own dedicated cell (with the indent,
  // disclosure arrow and type marker), so it is never repeated here even
  // if a project's view.columns list happens to include it.
  const extraColumns = columns.filter((column) => column !== 'name')

  return (
    <div className="task-table" style={{ '--row-height': `${ROW_HEIGHT}px` }}>
      <div className="task-table__header" role="row">
        {!readOnly && <div className="task-table__header-grip" aria-hidden="true" />}
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
            onRename={onRename}
            onAssigneeChange={onAssigneeChange}
            onColourChange={onColourChange}
            onFieldChange={onFieldChange}
            readOnly={readOnly}
            dragging={task.id === draggingId}
            dropPosition={dropTarget?.id === task.id ? dropTarget.position : null}
            onGripDragStart={readOnly ? undefined : handleGripDragStart}
            onRowDragOver={readOnly ? undefined : handleRowDragOver}
            onRowDrop={readOnly ? undefined : handleRowDrop}
            onGripDragEnd={handleGripDragEnd}
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
