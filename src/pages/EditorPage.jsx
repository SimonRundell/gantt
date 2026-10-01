import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import StatusBar from '../components/StatusBar.jsx'
import TaskTable from '../components/TaskTable.jsx'
import Timeline from '../components/Timeline.jsx'
import Toolbar from '../components/Toolbar.jsx'
import { snapForwardToWorkingDay, workingDaysBetween } from '../lib/calendar.js'
import { addCalendarDays } from '../lib/dates.js'
import { computeEnd, criticalPath } from '../lib/scheduler.js'
import { createPerformanceSampleProject, createStarterProject } from '../lib/sampleProject.js'
import { flattenVisibleRows } from '../lib/taskTree.js'
import { pxPerDayFor } from '../lib/timelineScale.js'
import { useProject } from '../hooks/useProject.js'
import { ProjectProvider } from '../state/ProjectContext.jsx'

const MIN_TABLE_WIDTH = 240
const MAX_TABLE_WIDTH = 720

/**
 * The project editor, reached at /p/:id. Loads a local sample project
 * for now; real server loading and saving are wired up once the
 * save/load phase of the build is reached.
 * @returns {JSX.Element} the editor page
 */
function EditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()

  const project = useMemo(() => {
    if (searchParams.get('sample') === 'large') {
      return createPerformanceSampleProject(12, 10)
    }
    return createStarterProject()
  }, [searchParams])

  return (
    <ProjectProvider project={project}>
      <EditorContent projectId={id} />
    </ProjectProvider>
  )
}

/**
 * The editor's actual layout and interaction logic, split out from
 * EditorPage so it can call useProject (which needs to be inside the
 * provider).
 * @param {{projectId: string}} props
 * @returns {JSX.Element} the editor's content
 */
function EditorContent({ projectId }) {
  const { state, dispatch } = useProject()
  const { project, selection, history } = state

  const [tableWidth, setTableWidth] = useState(360)
  const [scrollTop, setScrollTop] = useState(0)
  const timelineApiRef = useRef(null)

  const rows = useMemo(() => flattenVisibleRows(project.tasks), [project.tasks])
  const tasksById = useMemo(() => new Map(project.tasks.map((t) => [t.id, t])), [project.tasks])
  const predecessorsByTask = useMemo(() => {
    const map = new Map()
    for (const dep of project.dependencies) {
      if (!map.has(dep.to)) map.set(dep.to, [])
      map.get(dep.to).push(dep)
    }
    return map
  }, [project.dependencies])

  const criticalTaskIds = useMemo(() => {
    if (!project.view.showCriticalPath) return new Set()
    return new Set(criticalPath(project).criticalTaskIds)
  }, [project])

  const selectedTask = selection.taskId ? tasksById.get(selection.taskId) ?? null : null

  const projectSpan = useMemo(() => {
    if (project.tasks.length === 0) return { start: null, end: null }
    let start = project.tasks[0].start
    let end = computeEnd(project.tasks[0], project.calendar)
    for (const task of project.tasks) {
      if (task.start < start) start = task.start
      const taskEnd = computeEnd(task, project.calendar)
      if (taskEnd > end) end = taskEnd
    }
    return { start, end }
  }, [project.tasks, project.calendar])

  const handleScroll = useCallback((value) => setScrollTop(value), [])

  useEffect(() => {
    /**
     * Routes global keyboard shortcuts (undo, redo) while the editor
     * is open.
     * @param {KeyboardEvent} event - the keydown event
     * @returns {void}
     */
    function handleKeyDown(event) {
      const ctrlOrCmd = event.ctrlKey || event.metaKey
      const isEditingText = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA'

      if (ctrlOrCmd && event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault()
        dispatch({ type: 'REDO' })
      } else if (ctrlOrCmd && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        dispatch({ type: 'UNDO' })
      } else if (ctrlOrCmd && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        dispatch({ type: 'REDO' })
      } else if (!isEditingText && (event.key === 'Delete' || event.key === 'Backspace') && selection.taskId) {
        event.preventDefault()
        dispatch({ type: 'DELETE_TASK', taskId: selection.taskId })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch, selection.taskId])

  const handleSplitterPointerDown = (event) => {
    const startX = event.clientX
    const startWidth = tableWidth
    event.preventDefault()

    /**
     * Resizes the table pane as the splitter is dragged.
     * @param {PointerEvent} moveEvent - the pointer move event
     * @returns {void}
     */
    function handleMove(moveEvent) {
      const next = startWidth + (moveEvent.clientX - startX)
      setTableWidth(Math.min(MAX_TABLE_WIDTH, Math.max(MIN_TABLE_WIDTH, next)))
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const dragStateRef = useRef(null)

  /**
   * Starts a bar drag: moving the whole bar, resizing one edge, or
   * dragging the percent-complete handle. One BEGIN_DRAG/END_DRAG pair
   * wraps the whole gesture so it becomes a single undo step.
   * @param {string} taskId - the task being dragged
   * @param {import('react').PointerEvent} event - the pointer down event
   * @param {'move'|'resize-start'|'resize-end'|'percent'} handle - which part of the bar was grabbed
   * @param {number} barWidth - the bar's current width in pixels, used for percent dragging
   * @returns {void}
   */
  function handleBarPointerDown(taskId, event, handle, barWidth) {
    const task = tasksById.get(taskId)
    if (!task) return

    dragStateRef.current = {
      taskId,
      handle,
      startX: event.clientX,
      originalStart: task.start,
      originalEnd: computeEnd(task, project.calendar),
      originalPercent: task.percent,
      barWidth,
      pxPerDay: pxPerDayFor(project.view.zoom),
    }
    dispatch({ type: 'SELECT_TASK', taskId })
    dispatch({ type: 'BEGIN_DRAG' })

    window.addEventListener('pointermove', handleDragMove)
    window.addEventListener('pointerup', handleDragUp)
  }

  /**
   * Continues an in-progress bar drag, translating the pointer's
   * movement into a date, duration or percent change and previewing
   * it live without pushing an undo step yet.
   * @param {PointerEvent} event - the pointer move event
   * @returns {void}
   */
  function handleDragMove(event) {
    const drag = dragStateRef.current
    if (!drag) return
    const deltaPx = event.clientX - drag.startX

    if (drag.handle === 'percent') {
      const deltaPercent = drag.barWidth > 0 ? (deltaPx / drag.barWidth) * 100 : 0
      const percent = Math.max(0, Math.min(100, Math.round(drag.originalPercent + deltaPercent)))
      dispatch({ type: 'DRAG_PREVIEW', taskId: drag.taskId, fields: { percent } })
      return
    }

    const deltaDays = Math.round(deltaPx / drag.pxPerDay)

    if (drag.handle === 'move') {
      const start = snapForwardToWorkingDay(addCalendarDays(drag.originalStart, deltaDays), project.calendar)
      dispatch({ type: 'DRAG_PREVIEW', taskId: drag.taskId, fields: { start } })
    } else if (drag.handle === 'resize-end') {
      const rawEnd = addCalendarDays(drag.originalEnd, deltaDays)
      const end = snapForwardToWorkingDay(rawEnd, project.calendar)
      const durationDays = Math.max(1, workingDaysBetween(drag.originalStart, end, project.calendar) + 1)
      dispatch({ type: 'DRAG_PREVIEW', taskId: drag.taskId, fields: { durationDays } })
    } else if (drag.handle === 'resize-start') {
      const rawStart = addCalendarDays(drag.originalStart, deltaDays)
      const start = snapForwardToWorkingDay(rawStart, project.calendar)
      if (start > drag.originalEnd) return
      const durationDays = Math.max(1, workingDaysBetween(start, drag.originalEnd, project.calendar) + 1)
      dispatch({ type: 'DRAG_PREVIEW', taskId: drag.taskId, fields: { start, durationDays } })
    }
  }

  /**
   * Ends an in-progress bar drag and commits it as one undo step.
   * @returns {void}
   */
  function handleDragUp() {
    window.removeEventListener('pointermove', handleDragMove)
    window.removeEventListener('pointerup', handleDragUp)
    dragStateRef.current = null
    dispatch({ type: 'END_DRAG' })
  }

  return (
    <div className="editor-page">
      <Toolbar
        title={project.title}
        onTitleChange={(title) => dispatch({ type: 'SET_TITLE', title })}
        zoom={project.view.zoom}
        onZoomChange={(zoom) => dispatch({ type: 'SET_ZOOM', zoom })}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onGoToToday={() => timelineApiRef.current?.scrollToToday()}
        onAddTask={(taskType) => dispatch({ type: 'ADD_TASK', afterTaskId: selection.taskId, taskType })}
        hasSelection={Boolean(selection.taskId)}
        onDeleteTask={() => selection.taskId && dispatch({ type: 'DELETE_TASK', taskId: selection.taskId })}
        onIndent={() => selection.taskId && dispatch({ type: 'INDENT_TASK', taskId: selection.taskId })}
        onOutdent={() => selection.taskId && dispatch({ type: 'OUTDENT_TASK', taskId: selection.taskId })}
        onMoveUp={() => selection.taskId && dispatch({ type: 'REORDER_TASK', taskId: selection.taskId, direction: 'up' })}
        onMoveDown={() => selection.taskId && dispatch({ type: 'REORDER_TASK', taskId: selection.taskId, direction: 'down' })}
        showCriticalPath={project.view.showCriticalPath}
        onToggleCriticalPath={() => dispatch({ type: 'TOGGLE_CRITICAL_PATH' })}
        saveStatus={projectId ? `Project ${projectId}` : 'Local sample'}
      />

      <div className="editor-page__body">
        <div className="editor-page__table-pane" style={{ width: tableWidth }}>
          <TaskTable
            rows={rows}
            columns={project.view.columns}
            selectedTaskId={selection.taskId}
            calendar={project.calendar}
            predecessorsByTask={predecessorsByTask}
            tasksById={tasksById}
            onSelect={(taskId) => dispatch({ type: 'SELECT_TASK', taskId })}
            onToggleCollapse={(taskId) => dispatch({ type: 'TOGGLE_COLLAPSE', taskId })}
            onRename={(taskId, name) => dispatch({ type: 'RENAME_TASK', taskId, name })}
            onAssigneeChange={(taskId, assignee) =>
              dispatch({ type: 'UPDATE_TASK_FIELDS', taskId, fields: { assignee } })
            }
            onColourChange={(taskId, colour) => dispatch({ type: 'UPDATE_TASK_FIELDS', taskId, fields: { colour } })}
            scrollTop={scrollTop}
            onScroll={handleScroll}
          />
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div
          className="editor-page__splitter"
          onPointerDown={handleSplitterPointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize task table"
          tabIndex={0}
        />

        <div className="editor-page__timeline-pane">
          <Timeline
            rows={rows}
            calendar={project.calendar}
            zoom={project.view.zoom}
            selectedTaskId={selection.taskId}
            criticalTaskIds={criticalTaskIds}
            onSelect={(taskId) => dispatch({ type: 'SELECT_TASK', taskId })}
            scrollTop={scrollTop}
            onScroll={handleScroll}
            onZoomChange={(zoom) => dispatch({ type: 'SET_ZOOM', zoom })}
            onBarPointerDown={handleBarPointerDown}
            scrollApiRef={timelineApiRef}
          />
        </div>
      </div>

      <StatusBar
        selectedTask={selectedTask}
        selectedTaskEnd={selectedTask ? computeEnd(selectedTask, project.calendar) : null}
        projectStart={projectSpan.start}
        projectEnd={projectSpan.end}
        taskCount={project.tasks.length}
      />
    </div>
  )
}

export default EditorPage
