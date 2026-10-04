import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ConflictDialog from '../components/ConflictDialog.jsx'
import DependencyEditor from '../components/DependencyEditor.jsx'
import ExportDialog from '../components/ExportDialog.jsx'
import FullChartView from '../components/FullChartView.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import { resolveScale } from '../lib/timelineScale.js'
import BaselineDialog from '../components/BaselineDialog.jsx'
import CalendarDialog from '../components/CalendarDialog.jsx'
import ColumnsDialog from '../components/ColumnsDialog.jsx'
import CsvImportDialog from '../components/CsvImportDialog.jsx'
import FilterDialog from '../components/FilterDialog.jsx'
import ResourcesDialog from '../components/ResourcesDialog.jsx'
import TaskPanel from '../components/TaskPanel.jsx'
import ShortcutsDialog from '../components/ShortcutsDialog.jsx'
import StatusBar from '../components/StatusBar.jsx'
import TaskTable from '../components/TaskTable.jsx'
import Timeline from '../components/Timeline.jsx'
import Toast from '../components/Toast.jsx'
import Toolbar from '../components/Toolbar.jsx'
import UploadChoiceDialog from '../components/UploadChoiceDialog.jsx'
import { parseTasksCsv } from '../lib/csvTasks.js'
import { todayISO } from '../lib/dates.js'
import { downloadProjectJson, downloadTasksCsv, downloadTasksXlsx } from '../lib/downloadFile.js'
import { migrate } from '../lib/migrate.js'
import { recordRecentProject } from '../lib/recentProjects.js'
import { computeEnd, criticalPath } from '../lib/scheduler.js'
import { createPerformanceSampleProject } from '../lib/sampleProject.js'
import { distinctAssignees, filterRows } from '../lib/taskFilter.js'
import { flattenVisibleRows } from '../lib/taskTree.js'
import { sanitizeForImport, validateProject } from '../lib/validate.js'
import { useAutosave } from '../hooks/useAutosave.js'
import { useBarDrag } from '../hooks/useBarDrag.js'
import { useProject } from '../hooks/useProject.js'
import { createProject, getProject } from '../services/projects.js'
import { ProjectProvider } from '../state/ProjectContext.jsx'

const MIN_TABLE_WIDTH = 240
const MAX_TABLE_WIDTH = 720

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
  const sampleSize = searchParams.get('sample')
  const sampleMode = sampleSize === 'large' || sampleSize === 'huge'

  const [load, setLoad] = useState({ status: 'loading', project: null, editToken: null, canEdit: false, error: null })

  useEffect(() => {
    let cancelled = false

    /** Loads the project from the server, or builds the sample project in sample mode. */
    async function run() {
      if (sampleMode) {
        const project = (sampleSize === 'huge' ? createPerformanceSampleProject(40, 12) : createPerformanceSampleProject(12, 10))
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
  }, [id, tokenFromUrl, sampleMode, sampleSize])

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
    // Keyed on id so navigating from one project straight to another
    // (without an intervening full page load) remounts the whole
    // subtree fresh, rather than reusing component instances whose
    // state (undo history, save status, dialogs) was built for a
    // different project.
    <ProjectProvider key={id} project={load.project}>
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
  'SET_SCALE',
  'TOGGLE_CRITICAL_PATH',
  'TOGGLE_BASELINE',
  'SET_COLUMNS',
  'SET_VIEW_OPTION',
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
  const [shareOpen, setShareOpen] = useState(justCreated)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [uploadChoice, setUploadChoice] = useState(null)
  const [csvImport, setCsvImport] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [baselineOpen, setBaselineOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterFromISO, setFilterFromISO] = useState('')
  const [filterToISO, setFilterToISO] = useState('')
  const timelineApiRef = useRef(null)
  const fileInputRef = useRef(null)
  const exportNodeRef = useRef(null)

  const rows = useMemo(() => flattenVisibleRows(project.tasks), [project.tasks])
  const assigneeOptions = useMemo(() => distinctAssignees(project.tasks), [project.tasks])
  const filterActive = filterAssignee !== '' || filterFromISO !== '' || filterToISO !== ''
  const filteredRows = useMemo(
    () => filterRows(rows, project.calendar, { assignee: filterAssignee, fromISO: filterFromISO, toISO: filterToISO }),
    [rows, project.calendar, filterAssignee, filterFromISO, filterToISO],
  )
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
  const selectedHasChildren = selectedTask ? project.tasks.some((t) => t.parentId === selectedTask.id) : false
  const scale = resolveScale(project.view)
  const hasBaseline = project.tasks.some((t) => t.baseline)

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

  const { saveStatus, setSaveStatus, conflict, setConflict, save, markSaved } = useAutosave({
    projectId,
    editToken,
    canEdit,
    project,
    rawDispatch,
  })

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
      } else if (!isEditingText && event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch, selection.taskId])

  /** Starts resizing the table pane when the splitter is grabbed. */
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

    /** Stops resizing the table pane when the pointer is released. */
    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const handleBarPointerDown = useBarDrag({ project, tasksById, dispatch, canEdit })

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
   * @param {{format: 'png'|'pdf'|'csv'|'xlsx', pageSize: 'a4'|'a3', orientation: 'portrait'|'landscape', fit: 'width'|'tile'}} options - the chosen export options
   * @returns {Promise<void>} resolves once the download has started
   */
  async function handleExport(options) {
    if (options.format === 'csv') {
      downloadTasksCsv(project)
      return
    }
    if (options.format === 'xlsx') {
      // Loaded on demand: exceljs is only needed if a student actually
      // exports a workbook, and it is too large to add to the main
      // bundle just in case.
      const { tasksToXlsxBuffer } = await import('../lib/xlsxTasks.js')
      downloadTasksXlsx(project, await tasksToXlsxBuffer(project))
      return
    }
    const node = exportNodeRef.current
    if (!node) return
    // Loaded on demand rather than imported at the top of the file:
    // jsPDF and html-to-image are only needed if a student actually
    // exports an image or PDF, and pulling them into the main bundle
    // added several hundred kilobytes every student would download
    // just to open the editor.
    const { exportChartAsPdf, exportChartAsPng } = await import('../lib/exportChart.js')
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

    if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
      const earliest = project.tasks.reduce((min, t) => (t.start < min ? t.start : min), todayISO())
      setCsvImport({ fileName: file.name, result: parseTasksCsv(text, { defaultStart: earliest }) })
      return
    }

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
        zoom={scale.custom ? 'custom' : project.view.zoom}
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
        detailsOpen={detailsOpen}
        onToggleDetails={() => setDetailsOpen((open) => !open)}
        snap={project.view.snap ?? 'day'}
        onSnapChange={(snap) => dispatch({ type: 'SET_VIEW_OPTION', key: 'snap', value: snap })}
        onOpenColumns={() => setColumnsOpen(true)}
        onOpenResources={() => setResourcesOpen(true)}
        onOpenBaseline={() => setBaselineOpen(true)}
        onOpenFilter={() => setFilterOpen(true)}
        filterActive={filterActive}
        onOpenCalendar={() => setCalendarOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json,text/csv,.csv"
        className="home-page__file-input"
        onChange={handleUploadFile}
        aria-label="Upload a project file or a CSV task list"
      />

      <div className="editor-page__body">
        <div className="editor-page__table-pane" style={{ width: tableWidth }}>
          <TaskTable
            rows={filteredRows}
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
            onFieldChange={(taskId, fields) => dispatch({ type: 'UPDATE_TASK_FIELDS', taskId, fields })}
            onMoveTask={(taskId, targetId, position) => dispatch({ type: 'MOVE_TASK', taskId, targetId, position })}
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
            rows={filteredRows}
            dependencies={project.dependencies}
            calendar={project.calendar}
            scale={scale}
            selectedTaskId={selection.taskId}
            selectedDependencyId={selectedDependencyId}
            criticalTaskIds={criticalTaskIds}
            showBaseline={Boolean(project.view.showBaseline)}
            showAssignee={Boolean(project.view.showAssigneeOnBars)}
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
            onScaleChange={(pxPerDay) => dispatch({ type: 'SET_SCALE', pxPerDay })}
            onBarPointerDown={handleBarPointerDown}
            scrollApiRef={timelineApiRef}
          />
        </div>

        {detailsOpen && (
          <TaskPanel
            task={selectedTask}
            hasChildren={selectedHasChildren}
            calendar={project.calendar}
            readOnly={!canEdit}
            onFieldChange={(taskId, fields) => dispatch({ type: 'UPDATE_TASK_FIELDS', taskId, fields })}
            onTypeChange={(taskId, taskType) => dispatch({ type: 'SET_TASK_TYPE', taskId, taskType })}
            onDuplicate={(taskId) => dispatch({ type: 'DUPLICATE_TASK', taskId })}
            onDelete={(taskId) => dispatch({ type: 'DELETE_TASK', taskId })}
            onAddComment={(taskId, author, text) => dispatch({ type: 'ADD_COMMENT', taskId, author, text })}
            onClose={() => setDetailsOpen(false)}
          />
        )}
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

      {csvImport && (
        <CsvImportDialog
          fileName={csvImport.fileName}
          result={csvImport.result}
          onAppend={() => {
            dispatch({ type: 'IMPORT_TASKS', mode: 'append', tasks: csvImport.result.tasks, dependencies: csvImport.result.dependencies })
            setCsvImport(null)
          }}
          onReplace={() => {
            dispatch({ type: 'IMPORT_TASKS', mode: 'replace', tasks: csvImport.result.tasks, dependencies: csvImport.result.dependencies })
            setCsvImport(null)
          }}
          onCancel={() => setCsvImport(null)}
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
            markSaved({
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
            await save(conflict.revision)
          }}
        />
      )}

      {calendarOpen && (
        <CalendarDialog
          calendar={project.calendar}
          onClose={() => setCalendarOpen(false)}
          onSave={(calendar) => {
            dispatch({ type: 'SET_CALENDAR', calendar })
            setCalendarOpen(false)
          }}
        />
      )}

      {columnsOpen && (
        <ColumnsDialog
          columns={project.view.columns}
          showAssigneeOnBars={Boolean(project.view.showAssigneeOnBars)}
          onColumnsChange={(columns) => dispatch({ type: 'SET_COLUMNS', columns })}
          onShowAssigneeChange={(value) => dispatch({ type: 'SET_VIEW_OPTION', key: 'showAssigneeOnBars', value })}
          onClose={() => setColumnsOpen(false)}
        />
      )}

      {resourcesOpen && (
        <ResourcesDialog tasks={project.tasks} calendar={project.calendar} onClose={() => setResourcesOpen(false)} />
      )}

      {baselineOpen && (
        <BaselineDialog
          hasBaseline={hasBaseline}
          showBaseline={Boolean(project.view.showBaseline)}
          readOnly={!canEdit}
          onSet={() => dispatch({ type: 'SET_BASELINE' })}
          onClear={() => dispatch({ type: 'CLEAR_BASELINE' })}
          onToggleShow={() => dispatch({ type: 'TOGGLE_BASELINE' })}
          onClose={() => setBaselineOpen(false)}
        />
      )}

      {filterOpen && (
        <FilterDialog
          assigneeOptions={assigneeOptions}
          assignee={filterAssignee}
          onAssigneeChange={setFilterAssignee}
          fromISO={filterFromISO}
          onFromChange={setFilterFromISO}
          toISO={filterToISO}
          onToChange={setFilterToISO}
          shownCount={filteredRows.length}
          totalCount={rows.length}
          onClear={() => {
            setFilterAssignee('')
            setFilterFromISO('')
            setFilterToISO('')
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {exportOpen && <ExportDialog onExport={handleExport} onClose={() => setExportOpen(false)} />}

      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}

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
