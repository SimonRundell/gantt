import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ConflictDialog from '../components/ConflictDialog.jsx'
import DependencyEditor from '../components/DependencyEditor.jsx'
import ExportDialog from '../components/ExportDialog.jsx'
import FullChartView from '../components/FullChartView.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import StatusBar from '../components/StatusBar.jsx'
import TaskTable from '../components/TaskTable.jsx'
import Timeline from '../components/Timeline.jsx'
import Toast from '../components/Toast.jsx'
import Toolbar from '../components/Toolbar.jsx'
import UploadChoiceDialog from '../components/UploadChoiceDialog.jsx'
import { snapForwardToWorkingDay, workingDaysBetween } from '../lib/calendar.js'
import { addCalendarDays } from '../lib/dates.js'
import { downloadProjectJson } from '../lib/downloadFile.js'
import { exportChartAsPdf, exportChartAsPng } from '../lib/exportChart.js'
import { migrate } from '../lib/migrate.js'
import { recordRecentProject } from '../lib/recentProjects.js'
import { computeEnd, criticalPath } from '../lib/scheduler.js'
import { createPerformanceSampleProject } from '../lib/sampleProject.js'
import { flattenVisibleRows } from '../lib/taskTree.js'
import { pxPerDayFor } from '../lib/timelineScale.js'
import { sanitizeForImport, validateProject } from '../lib/validate.js'
import { useProject } from '../hooks/useProject.js'
import { createProject, getProject, saveProject } from '../services/projects.js'
import { ProjectProvider } from '../state/ProjectContext.jsx'

const MIN_TABLE_WIDTH = 240
const MAX_TABLE_WIDTH = 720
const AUTOSAVE_DELAY_MS = 1500

/**
 * The project editor, reached at /p/:id. Loads the project from the
 * server (or, for local performance testing, a generated sample via
 * ?sample=large) and hands off to EditorContent once it is ready.
 * @returns {JSX.Element} the editor page
 */
function EditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const tokenFromUrl = searchParams.get('k')
  const sampleMode = searchParams.get('sample') === 'large'

  const [load, setLoad] = useState({ status: 'loading', project: null, editToken: null, canEdit: false, error: null })

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (sampleMode) {
        const project = createPerformanceSampleProject(12, 10)
        if (!cancelled) setLoad({ status: 'ready', project, editToken: null, canEdit: true, error: null })
        return
      }

      try {
        const data = await getProject(id, tokenFromUrl)
        if (cancelled) return
        const editToken = data.canEdit ? tokenFromUrl : null
        recordRecentProject({ id, title: data.title, editToken })
        setLoad({ status: 'ready', project: data, editToken, canEdit: data.canEdit, error: null })
      } catch (err) {
        if (cancelled) return
        const message =
          err.response?.status === 404
            ? 'This chart could not be found. Check the link and try again.'
            : 'Could not load this chart. Check your connection and try again.'
        setLoad({ status: 'error', project: null, editToken: null, canEdit: false, error: message })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [id, tokenFromUrl, sampleMode])

  if (load.status === 'loading') {
    return (
      <main className="editor-page__status">
        <p>Loading chart…</p>
      </main>
    )
  }

  if (load.status === 'error') {
    return (
      <main className="editor-page__status">
        <p>{load.error}</p>
      </main>
    )
  }

  return (
    <ProjectProvider project={load.project}>
      <EditorContent
        projectId={id}
        editToken={load.editToken}
        canEdit={load.canEdit}
        justCreated={Boolean(location.state?.justCreated)}
      />
    </ProjectProvider>
  )
}

/** @type {Set<string>} action types allowed through even when the project is read-only */
const READ_ONLY_SAFE_ACTIONS = new Set([
  'SELECT_TASK',
  'SET_ZOOM',
  'TOGGLE_CRITICAL_PATH',
  'TOGGLE_BASELINE',
  'SET_COLUMNS',
  'TOGGLE_COLLAPSE',
  'DISMISS_ERROR',
  'SET_SAVE_STATUS',
  'UNDO',
  'REDO',
])

/**
 * The editor's actual layout and interaction logic, split out from
 * EditorPage so it can call useProject (which needs to be inside the
 * provider).
 * @param {{projectId: string, editToken: string|null, canEdit: boolean, justCreated: boolean}} props
 * @returns {JSX.Element} the editor's content
 */
function EditorContent({ projectId, editToken, canEdit, justCreated }) {
  const navigate = useNavigate()
  const { state, dispatch: rawDispatch } = useProject()
  const { project, selection, history } = state

  /**
   * Blocks content-changing actions when the project was opened
   * read-only (no valid edit token), while still allowing navigation,
   * zoom and selection so a view-only visitor can look around.
   * @param {{type: string, [key: string]: unknown}} action - the action to dispatch
   * @returns {void}
   */
  const dispatch = useCallback(
    (action) => {
      if (!canEdit && !READ_ONLY_SAFE_ACTIONS.has(action.type)) return
      rawDispatch(action)
    },
    [canEdit, rawDispatch],
  )

  const [tableWidth, setTableWidth] = useState(360)
  const [scrollTop, setScrollTop] = useState(0)
  const [selectedDependencyId, setSelectedDependencyId] = useState(null)
  const [saveStatus, setSaveStatus] = useState(canEdit ? 'Saved' : 'View only')
  const [conflict, setConflict] = useState(null)
  const [shareOpen, setShareOpen] = useState(justCreated)
  const [uploadChoice, setUploadChoice] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const timelineApiRef = useRef(null)
  const fileInputRef = useRef(null)
  const exportNodeRef = useRef(null)

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

  // Tracks the content of the version already saved (or just loaded),
  // as a JSON string for a cheap equality check. Starting it at null
  // and filling it in on the first effect run - rather than a simple
  // "is this the first render" boolean - means React StrictMode's
  // deliberate double-invocation of effects in development can't
  // trick this into firing a spurious extra save: the second
  // invocation just finds the content unchanged.
  const lastSavedContentRef = useRef(null)

  /**
   * Saves the current project to the server. On success, updates the
   * revision the editor is tracking. On a 409 (someone else saved a
   * newer version first), opens the conflict dialog instead of
   * silently losing either copy.
   * @returns {Promise<void>} resolves once the save attempt finishes
   */
  const save = useCallback(async () => {
    if (!canEdit || !editToken || projectId == null) return
    const content = {
      title: project.title,
      calendar: project.calendar,
      view: project.view,
      tasks: project.tasks,
      dependencies: project.dependencies,
    }
    setSaveStatus('Saving…')
    try {
      const result = await saveProject(projectId, editToken, { revision: project.revision, ...content })
      rawDispatch({ type: 'SET_SERVER_META', fields: { revision: result.revision, updatedAt: result.updatedAt } })
      lastSavedContentRef.current = JSON.stringify(content)
      setSaveStatus('Saved')
    } catch (err) {
      if (err.response?.status === 409) {
        setConflict(err.response.data.project)
        setSaveStatus('Unsaved changes')
      } else {
        setSaveStatus('Could not save - will try again')
      }
    }
  }, [canEdit, editToken, projectId, project, rawDispatch])

  useEffect(() => {
    const current = JSON.stringify({
      title: project.title,
      calendar: project.calendar,
      view: project.view,
      tasks: project.tasks,
      dependencies: project.dependencies,
    })

    if (lastSavedContentRef.current === null) {
      lastSavedContentRef.current = current
      return undefined
    }
    if (current === lastSavedContentRef.current || !canEdit || conflict) return undefined

    setSaveStatus('Unsaved changes')
    const timer = setTimeout(save, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
    // Only the undoable content and the calendar/title/view are worth
    // autosaving on; re-running this effect on every render would
    // debounce against itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.title, project.calendar, project.view, project.tasks, project.dependencies])

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
    if (!canEdit) return
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

  /**
   * Creates a dependency after a connector drag completes over a
   * valid target. Rejected (circular) attempts surface through
   * state.ui.lastError and are shown in the toast.
   * @param {string} fromTaskId - the predecessor task's id
   * @param {string} toTaskId - the successor task's id
   * @param {string} depType - one of FS, SS, FF, SF
   * @returns {void}
   */
  function handleCreateDependency(fromTaskId, toTaskId, depType) {
    dispatch({ type: 'ADD_DEPENDENCY', from: fromTaskId, to: toTaskId, depType, lagDays: 0 })
  }

  /**
   * Exports the whole chart (not just the visible area) as a PNG or a
   * PDF, rasterising the off-screen, unscrolled FullChartView rather
   * than anything currently on screen.
   * @param {{format: 'png'|'pdf', pageSize: 'a4'|'a3', orientation: 'portrait'|'landscape', fit: 'width'|'tile'}} options - the chosen export options
   * @returns {Promise<void>} resolves once the download has started
   */
  async function handleExport(options) {
    const node = exportNodeRef.current
    if (!node) return
    if (options.format === 'png') {
      await exportChartAsPng(node, project.title)
    } else {
      await exportChartAsPdf(node, { title: project.title, ...options })
    }
  }

  /**
   * Reads and validates an uploaded `.json` file, then offers the
   * choice to open it as a new chart or replace this one.
   * @param {import('react').ChangeEvent<HTMLInputElement>} event - the file input change event
   * @returns {Promise<void>} resolves once the file has been handled
   */
  async function handleUploadFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const text = await file.text()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      window.alert('That file is not valid JSON, so it could not be read.')
      return
    }

    const migrated = migrate(parsed)
    if (!migrated.ok) {
      window.alert(migrated.error)
      return
    }

    const result = validateProject(migrated.doc)
    if (!result.valid) {
      window.alert(`This file has some problems:\n\n${result.problems.join('\n')}`)
      return
    }

    setUploadChoice(sanitizeForImport(migrated.doc))
  }

  const editLink = editToken ? `${window.location.origin}/p/${projectId}?k=${editToken}` : ''
  const viewLink = `${window.location.origin}/p/${projectId}`

  const selectedDependency = project.dependencies.find((d) => d.id === selectedDependencyId) ?? null

  return (
    <div className="editor-page">
      <Toolbar
        title={project.title}
        onTitleChange={(title) => dispatch({ type: 'SET_TITLE', title })}
        zoom={project.view.zoom}
        onZoomChange={(zoom) => dispatch({ type: 'SET_ZOOM', zoom })}
        canUndo={canEdit && history.past.length > 0}
        canRedo={canEdit && history.future.length > 0}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onGoToToday={() => timelineApiRef.current?.scrollToToday()}
        onAddTask={(taskType) => dispatch({ type: 'ADD_TASK', afterTaskId: selection.taskId, taskType })}
        hasSelection={canEdit && Boolean(selection.taskId)}
        onDeleteTask={() => selection.taskId && dispatch({ type: 'DELETE_TASK', taskId: selection.taskId })}
        onIndent={() => selection.taskId && dispatch({ type: 'INDENT_TASK', taskId: selection.taskId })}
        onOutdent={() => selection.taskId && dispatch({ type: 'OUTDENT_TASK', taskId: selection.taskId })}
        onMoveUp={() => selection.taskId && dispatch({ type: 'REORDER_TASK', taskId: selection.taskId, direction: 'up' })}
        onMoveDown={() => selection.taskId && dispatch({ type: 'REORDER_TASK', taskId: selection.taskId, direction: 'down' })}
        showCriticalPath={project.view.showCriticalPath}
        onToggleCriticalPath={() => dispatch({ type: 'TOGGLE_CRITICAL_PATH' })}
        saveStatus={saveStatus}
        readOnly={!canEdit}
        onDownload={() => downloadProjectJson(project)}
        onUploadClick={() => fileInputRef.current?.click()}
        onShare={() => setShareOpen(true)}
        onExport={() => setExportOpen(true)}
        onPrint={() => window.open(`/print/${projectId}`, '_blank', 'noopener')}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="home-page__file-input"
        onChange={handleUploadFile}
        aria-label="Upload a project file"
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
            readOnly={!canEdit}
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
            dependencies={project.dependencies}
            calendar={project.calendar}
            zoom={project.view.zoom}
            selectedTaskId={selection.taskId}
            selectedDependencyId={selectedDependencyId}
            criticalTaskIds={criticalTaskIds}
            onSelect={(taskId) => {
              dispatch({ type: 'SELECT_TASK', taskId })
              setSelectedDependencyId(null)
            }}
            onSelectDependency={(dependencyId) =>
              setSelectedDependencyId((current) => (current === dependencyId ? null : dependencyId))
            }
            onCreateDependency={canEdit ? handleCreateDependency : () => {}}
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

      {selectedDependency && canEdit && (
        <DependencyEditor
          dependency={selectedDependency}
          fromTask={tasksById.get(selectedDependency.from)}
          toTask={tasksById.get(selectedDependency.to)}
          onChangeType={(type) =>
            dispatch({ type: 'UPDATE_DEPENDENCY', dependencyId: selectedDependency.id, fields: { type } })
          }
          onChangeLag={(lagDays) =>
            dispatch({ type: 'UPDATE_DEPENDENCY', dependencyId: selectedDependency.id, fields: { lagDays } })
          }
          onDelete={() => {
            dispatch({ type: 'DELETE_DEPENDENCY', dependencyId: selectedDependency.id })
            setSelectedDependencyId(null)
          }}
          onClose={() => setSelectedDependencyId(null)}
        />
      )}

      <Toast message={state.ui.lastError} onDismiss={() => dispatch({ type: 'DISMISS_ERROR' })} />

      {shareOpen && <ShareDialog editLink={editLink} viewLink={viewLink} onClose={() => setShareOpen(false)} />}

      {uploadChoice && (
        <UploadChoiceDialog
          fileTitle={uploadChoice.title}
          onOpenAsNew={async () => {
            const created = await createProject(uploadChoice)
            recordRecentProject({ id: created.id, title: created.project.title, editToken: created.editToken })
            setUploadChoice(null)
            navigate(`/p/${created.id}?k=${created.editToken}`, { state: { justCreated: true } })
          }}
          onReplace={() => {
            rawDispatch({ type: 'IMPORT_PROJECT', project: uploadChoice })
            setUploadChoice(null)
          }}
          onCancel={() => setUploadChoice(null)}
        />
      )}

      {conflict && (
        <ConflictDialog
          onDownloadMine={() => downloadProjectJson(project)}
          onUseTheirs={() => {
            rawDispatch({ type: 'IMPORT_PROJECT', project: conflict })
            rawDispatch({
              type: 'SET_SERVER_META',
              fields: { revision: conflict.revision, updatedAt: conflict.updatedAt },
            })
            lastSavedContentRef.current = JSON.stringify({
              title: conflict.title,
              calendar: conflict.calendar,
              view: conflict.view,
              tasks: conflict.tasks,
              dependencies: conflict.dependencies,
            })
            setConflict(null)
            setSaveStatus('Saved')
          }}
          onKeepMine={async () => {
            rawDispatch({ type: 'SET_SERVER_META', fields: { revision: conflict.revision } })
            setConflict(null)
            await save()
          }}
        />
      )}

      {exportOpen && <ExportDialog onExport={handleExport} onClose={() => setExportOpen(false)} />}

      {/* Rendered off-screen at full size (no scrolling, no windowing) so
          PNG/PDF export always captures the entire chart, not just the
          part currently visible in the editor's scrollable viewport. */}
      <div className="export-offscreen" aria-hidden="true">
        <div ref={exportNodeRef}>
          <FullChartView project={project} />
        </div>
      </div>
    </div>
  )
}

export default EditorPage
