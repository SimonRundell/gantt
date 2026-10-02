import { useEffect, useRef, useState } from 'react'
import { ROW_HEIGHT } from '../lib/constants.js'
import { useElementSize } from '../hooks/useElementSize.js'
import { useRowWindow } from '../hooks/useRowWindow.js'
import { computeEnd } from '../lib/scheduler.js'
import { buildHeaderTiers, computeDateRange, dateToX, pxPerDayFor, ZOOM_LEVELS } from '../lib/timelineScale.js'
import { todayISO } from '../lib/dates.js'
import DependencyArrow from './DependencyArrow.jsx'
import MilestoneMarker from './MilestoneMarker.jsx'
import TaskBar from './TaskBar.jsx'
import TimelineGrid from './TimelineGrid.jsx'
import TimelineHeader from './TimelineHeader.jsx'
import TodayLine from './TodayLine.jsx'

const HEADER_HEIGHT = 48

/** @type {('day'|'week'|'month'|'quarter')[]} the zoom levels in order, for Ctrl+wheel cycling */
const ZOOM_ORDER = ['day', 'week', 'month', 'quarter']

/**
 * Finds the x position of a task's start or end edge.
 * @param {import('../lib/scheduler.js').Task} task - the task
 * @param {'start'|'end'} edge - which edge
 * @param {string} startISO - the timeline's range start date
 * @param {number} pxPerDay - pixels per calendar day
 * @param {import('../lib/calendar.js').WorkingCalendar} calendar - the project's working calendar
 * @returns {number} the x position in pixels
 */
function edgeX(task, edge, startISO, pxPerDay, calendar) {
  if (edge === 'end') {
    return dateToX(computeEnd(task, calendar), startISO, pxPerDay) + pxPerDay
  }
  return dateToX(task.start, startISO, pxPerDay)
}

/**
 * The SVG timeline on the right of the editor: header, background
 * grid, task bars, milestones, dependency arrows and the today line.
 * Vertical scroll stays in sync with the task table via the shared
 * scrollTop prop. Dragging from a bar's connector dot to another bar
 * creates a new dependency.
 * @param {object} props
 * @param {{task: import('../lib/scheduler.js').Task, depth: number, hasChildren: boolean}[]} props.rows - the visible rows, in the same order as the task table
 * @param {import('../lib/scheduler.js').Dependency[]} props.dependencies - every dependency in the project
 * @param {import('../lib/calendar.js').WorkingCalendar} props.calendar - the project's working calendar
 * @param {string} props.zoom - the current zoom level
 * @param {string|null} props.selectedTaskId - the currently selected task's id
 * @param {string|null} props.selectedDependencyId - the currently selected dependency's id
 * @param {Set<string>} props.criticalTaskIds - ids of tasks on the critical path, when it is shown
 * @param {(taskId: string) => void} props.onSelect - called when a bar or milestone is selected
 * @param {(dependencyId: string, event: import('react').MouseEvent) => void} props.onSelectDependency - called when a dependency arrow is clicked
 * @param {(fromTaskId: string, toTaskId: string, depType: string) => void} props.onCreateDependency - called when a connector drag completes over a valid target
 * @param {number} props.scrollTop - the vertical scroll offset to apply, kept in sync with the table
 * @param {(scrollTop: number) => void} props.onScroll - called when the timeline is scrolled vertically
 * @param {(zoom: string) => void} props.onZoomChange - called when Ctrl+wheel changes the zoom level
 * @param {(taskId: string, event: import('react').PointerEvent, handle: string, barWidth: number) => void} [props.onBarPointerDown] - called when a drag starts on a bar
 * @param {import('react').Ref<{scrollToToday: () => void}>} [props.scrollApiRef] - exposes a scrollToToday method to the parent
 * @returns {JSX.Element} the timeline pane
 */
function Timeline({
  rows,
  dependencies,
  calendar,
  zoom,
  selectedTaskId,
  selectedDependencyId,
  criticalTaskIds,
  onSelect,
  onSelectDependency,
  onCreateDependency,
  scrollTop,
  onScroll,
  onZoomChange,
  onBarPointerDown,
  scrollApiRef,
}) {
  const scrollRef = useRef(null)
  const svgRef = useRef(null)
  const { height: viewportHeight } = useElementSize(scrollRef)
  const pxPerDay = pxPerDayFor(zoom)
  const tasks = rows.map((r) => r.task)
  const { startISO, endISO } = computeDateRange(tasks, calendar)
  const totalWidth = dateToX(endISO, startISO, pxPerDay)
  const totalHeight = rows.length * ROW_HEIGHT
  const { minorTicks, majorTicks } = buildHeaderTiers(zoom, startISO, endISO, calendar.weekStartsOn)

  const { startIndex, endIndex } = useRowWindow(scrollTop, viewportHeight, rows.length, ROW_HEIGHT)
  const visibleRows = rows.slice(startIndex, endIndex)

  const rowTopByTaskId = new Map(rows.map((r, index) => [r.task.id, index * ROW_HEIGHT]))
  const tasksById = new Map(rows.map((r) => [r.task.id, r.task]))

  const today = todayISO()
  const todayX = dateToX(today, startISO, pxPerDay)

  useEffect(() => {
    if (scrollRef.current && scrollRef.current.scrollTop !== scrollTop) {
      scrollRef.current.scrollTop = scrollTop
    }
  }, [scrollTop])

  useEffect(() => {
    if (!scrollApiRef) return
    scrollApiRef.current = {
      scrollToToday: () => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = Math.max(0, todayX - scrollRef.current.clientWidth / 2)
        }
      },
    }
  }, [scrollApiRef, todayX])

  /**
   * Handles Ctrl/Cmd + wheel to step through zoom levels instead of
   * scrolling, and lets a plain wheel scroll the timeline normally.
   * @param {import('react').WheelEvent} event - the wheel event
   * @returns {void}
   */
  function handleWheel(event) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const index = ZOOM_ORDER.indexOf(zoom)
    const next = event.deltaY > 0 ? Math.min(index + 1, ZOOM_ORDER.length - 1) : Math.max(index - 1, 0)
    if (next !== index) onZoomChange(ZOOM_ORDER[next])
  }

  const panState = useRef(null)

  /**
   * Starts panning the timeline when the pointer goes down on empty
   * background rather than on a bar or milestone.
   * @param {import('react').PointerEvent} event - the pointer event
   * @returns {void}
   */
  function handleBackgroundPointerDown(event) {
    if (event.target !== event.currentTarget) return
    panState.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  /**
   * Continues an in-progress pan.
   * @param {import('react').PointerEvent} event - the pointer event
   * @returns {void}
   */
  function handleBackgroundPointerMove(event) {
    if (!panState.current || !scrollRef.current) return
    const dx = event.clientX - panState.current.startX
    const dy = event.clientY - panState.current.startY
    scrollRef.current.scrollLeft = panState.current.scrollLeft - dx
    scrollRef.current.scrollTop = panState.current.scrollTop - dy
  }

  function handleBackgroundPointerUp() {
    panState.current = null
  }

  const [pendingConnector, setPendingConnector] = useState(null)
  const connectorState = useRef(null)

  /**
   * Starts dragging a new dependency from a connector dot.
   * @param {string} taskId - the predecessor task's id
   * @param {'start'|'end'} edge - which edge of the predecessor was grabbed
   * @returns {void}
   */
  function handleConnectorPointerDown(taskId, edge) {
    const task = tasksById.get(taskId)
    if (!task) return
    const x = edgeX(task, edge, startISO, pxPerDay, calendar)
    const y = (rowTopByTaskId.get(taskId) ?? 0) + ROW_HEIGHT / 2
    connectorState.current = { taskId, edge }
    setPendingConnector({ x1: x, y1: y, x2: x, y2: y })
    window.addEventListener('pointermove', handleConnectorMove)
    window.addEventListener('pointerup', handleConnectorUp)
  }

  /**
   * Updates the rubber-band line as a new dependency is dragged out.
   * @param {PointerEvent} event - the pointer move event
   * @returns {void}
   */
  function handleConnectorMove(event) {
    if (!connectorState.current || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    setPendingConnector((prev) => (prev ? { ...prev, x2: event.clientX - rect.left, y2: event.clientY - rect.top } : prev))
  }

  /**
   * Finishes a dependency drag: looks at what is under the pointer and,
   * if it is a different task's bar or milestone, creates a
   * dependency. Dropping on a connector dot specifically targets that
   * edge; dropping anywhere else on a bar targets its start.
   * @param {PointerEvent} event - the pointer up event
   * @returns {void}
   */
  function handleConnectorUp(event) {
    window.removeEventListener('pointermove', handleConnectorMove)
    window.removeEventListener('pointerup', handleConnectorUp)

    const from = connectorState.current
    connectorState.current = null
    setPendingConnector(null)
    if (!from) return

    const target = document.elementFromPoint(event.clientX, event.clientY)
    const connectorEl = target?.closest('[data-connector-task-id]')
    const barEl = target?.closest('[data-task-id]')
    const toTaskId = connectorEl?.getAttribute('data-connector-task-id') ?? barEl?.getAttribute('data-task-id')
    if (!toTaskId || toTaskId === from.taskId) return

    const toEdge = connectorEl?.getAttribute('data-connector-edge') ?? 'start'
    const depType = (from.edge === 'end' ? 'F' : 'S') + (toEdge === 'end' ? 'F' : 'S')
    onCreateDependency(from.taskId, toTaskId, depType)
  }

  return (
    <div
      className="timeline"
      ref={scrollRef}
      onScroll={(event) => onScroll(event.currentTarget.scrollTop)}
      onWheel={handleWheel}
    >
      <div className="timeline__content" style={{ width: totalWidth }}>
        <TimelineHeader width={totalWidth} minorTicks={minorTicks} majorTicks={majorTicks} />
        <svg
          ref={svgRef}
          className="timeline__svg"
          width={totalWidth}
          height={totalHeight}
          role="group"
          aria-label="Chart timeline"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={handleBackgroundPointerUp}
          onPointerCancel={handleBackgroundPointerUp}
        >
          <TimelineGrid
            startISO={startISO}
            endISO={endISO}
            pxPerDay={pxPerDay}
            width={totalWidth}
            height={totalHeight}
            calendar={calendar}
            minorTicks={minorTicks}
          />
          <TodayLine x={todayX} height={totalHeight} />
          {dependencies.map((dep) => {
            const fromTask = tasksById.get(dep.from)
            const toTask = tasksById.get(dep.to)
            if (!fromTask || !toTask) return null
            return (
              <DependencyArrow
                key={dep.id}
                dependency={dep}
                fromTask={fromTask}
                toTask={toTask}
                fromRowTop={rowTopByTaskId.get(dep.from)}
                toRowTop={rowTopByTaskId.get(dep.to)}
                startISO={startISO}
                pxPerDay={pxPerDay}
                calendar={calendar}
                highlighted={dep.id === selectedDependencyId}
                onSelect={onSelectDependency}
              />
            )
          })}
          {pendingConnector && (
            <line
              x1={pendingConnector.x1}
              y1={pendingConnector.y1}
              x2={pendingConnector.x2}
              y2={pendingConnector.y2}
              className="dependency-arrow__pending"
            />
          )}
          {visibleRows.map(({ task }, index) => {
            const rowTop = (startIndex + index) * ROW_HEIGHT
            const barX = dateToX(task.start, startISO, pxPerDay)
            const critical = criticalTaskIds?.has(task.id) ?? false

            if (task.type === 'milestone') {
              return (
                <g key={task.id} data-task-id={task.id}>
                  <MilestoneMarker
                    task={task}
                    x={barX}
                    rowTop={rowTop}
                    selected={task.id === selectedTaskId}
                    critical={critical}
                    onSelect={onSelect}
                    onPointerDown={(event, handle) => onBarPointerDown?.(task.id, event, handle, 0)}
                    onConnectorPointerDown={handleConnectorPointerDown}
                  />
                </g>
              )
            }

            const endX = dateToX(computeEnd(task, calendar), startISO, pxPerDay) + pxPerDay
            return (
              <g key={task.id} data-task-id={task.id}>
                <TaskBar
                  task={task}
                  x={barX}
                  width={endX - barX}
                  rowTop={rowTop}
                  selected={task.id === selectedTaskId}
                  critical={critical}
                  onSelect={onSelect}
                  onPointerDown={(event, handle, barWidth) => onBarPointerDown?.(task.id, event, handle, barWidth)}
                  onConnectorPointerDown={handleConnectorPointerDown}
                />
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default Timeline
export { HEADER_HEIGHT, ZOOM_LEVELS }
