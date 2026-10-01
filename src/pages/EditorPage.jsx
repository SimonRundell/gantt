import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import StatusBar from '../components/StatusBar.jsx'
import TaskTable from '../components/TaskTable.jsx'
import Timeline from '../components/Timeline.jsx'
import Toolbar from '../components/Toolbar.jsx'
import { computeEnd, criticalPath } from '../lib/scheduler.js'
import { createPerformanceSampleProject, createStarterProject } from '../lib/sampleProject.js'
import { flattenVisibleRows } from '../lib/taskTree.js'
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
      if (!ctrlOrCmd) return

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault()
        dispatch({ type: 'REDO' })
      } else if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        dispatch({ type: 'UNDO' })
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        dispatch({ type: 'REDO' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch])

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
        onAddTask={() => dispatch({ type: 'ADD_TASK', afterTaskId: selection.taskId, taskType: 'task' })}
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
