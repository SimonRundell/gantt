import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ROW_HEIGHT } from '../lib/constants.js'
import { useElementSize } from '../hooks/useElementSize.js'
import { useRowWindow } from '../hooks/useRowWindow.js'
import { computeEnd } from '../lib/scheduler.js'
import { buildHeaderTiers, computeDateRange, dateToX, ZOOM_LEVELS, zoomAfterWheel } from '../lib/timelineScale.js'
import { todayISO } from '../lib/dates.js'
import DependencyArrow from './DependencyArrow.jsx'
import MilestoneMarker from './MilestoneMarker.jsx'
import TaskBar from './TaskBar.jsx'
import BaselineBar from './BaselineBar.jsx'
import PatternDefs from './PatternDefs.jsx'
import { baselineGeometry } from '../lib/baseline.js'
import TimelineGrid from './TimelineGrid.jsx'
import TimelineHeader from './TimelineHeader.jsx'
import TodayLine from './TodayLine.jsx'

const HEADER_HEIGHT = 48

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
 * @param {{pxPerDay: number, level: string}} props.scale - the current zoom: pixels per calendar day and the header style to draw
 * @param {string|null} props.selectedTaskId - the currently selected task's id
 * @param {string|null} props.selectedDependencyId - the currently selected dependency's id
 * @param {Set<string>} props.criticalTaskIds - ids of tasks on the critical path, when it is shown
 * @param {boolean} [props.showBaseline] - whether to draw each task's baseline bar
 * @param {boolean} [props.showAssignee] - whether to write assignees after task names
 * @param {(taskId: string) => void} props.onSelect - called when a bar or milestone is selected
 * @param {(dependencyId: string, event: import('react').MouseEvent) => void} props.onSelectDependency - called when a dependency arrow is clicked
 * @param {(fromTaskId: string, toTaskId: string, depType: string) => void} props.onCreateDependency - called when a connector drag completes over a valid target
 * @param {number} props.scrollTop - the vertical scroll offset to apply, kept in sync with the table
 * @param {(scrollTop: number) => void} props.onScroll - called when the timeline is scrolled vertically
 * @param {(pxPerDay: number) => void} props.onScaleChange - called when the mouse wheel changes the zoom
 * @param {(taskId: string, event: import('react').PointerEvent, handle: string, barWidth: number) => void} [props.onBarPointerDown] - called when a drag starts on a bar
 * @param {import('react').Ref<{scrollToToday: () => void}>} [props.scrollApiRef] - exposes a scrollToToday method to the parent
 * @returns {JSX.Element} the timeline pane
 */
function Timeline({
  rows,
  dependencies,
  calendar,
  scale,
  selectedTaskId,
  selectedDependencyId,
  criticalTaskIds,
  showBaseline,
  showAssignee,
  onSelect,
  onSelectDependency,
  onCreateDependency,
  scrollTop,
  onScroll,
  onScaleChange,
  onBarPointerDown,
  scrollApiRef,
}) {
  const scrollRef = useRef(null)
  const svgRef = useRef(null)
  const { height: viewportHeight } = useElementSize(scrollRef)
  const { pxPerDay, level } = scale
  const tasks = rows.map((r) => r.task)
  const { startISO, endISO } = computeDateRange(tasks, calendar)
  const totalWidth = dateToX(endISO, startISO, pxPerDay)
  const totalHeight = rows.length * ROW_HEIGHT
  const { minorTicks, majorTicks } = buildHeaderTiers(level, startISO, endISO, calendar.weekStartsOn, pxPerDay)

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

  // The zoom the wheel is heading for, and the date under the pointer
  // that should stay put while the zoom changes. Wheel events can arrive
  // faster than React renders, so the target is kept in a ref rather
  // than read back from props, which would lag and make the zoom stutter.
  const targetPxRef = useRef(pxPerDay)
  const appliedPxRef = useRef(pxPerDay)
  const anchorRef = useRef(null)
  const onScaleChangeRef = useRef(onScaleChange)
  const onScrollRef = useRef(onScroll)

  useEffect(() => {
    onScaleChangeRef.current = onScaleChange
    onScrollRef.current = onScroll
  })

  useEffect(() => {
    targetPxRef.current = pxPerDay
  }, [pxPerDay])

  // After the timeline redraws at the new zoom, scroll sideways so the
  // date that was under the pointer is still under it.
  useLayoutEffect(() => {
    const container = scrollRef.current
    const anchor = anchorRef.current
    appliedPxRef.current = pxPerDay
    if (!container || !anchor) return
    container.scrollLeft = Math.max(0, anchor.days * pxPerDay - anchor.pointerX)
    anchorRef.current = null
  }, [pxPerDay])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return undefined

    /**
     * Handles the mouse wheel over the timeline. A plain wheel (or a
     * pinch on a trackpad) zooms around the pointer. Shift+wheel and
     * sideways trackpad swipes scroll along the dates as normal, and
     * Alt+wheel scrolls up and down the rows. This has to be a native
     * listener, because React's wheel handlers are passive and cannot
     * stop the browser scrolling or zooming the whole page.
     * @param {WheelEvent} event - the wheel event
     * @returns {void}
     */
    function handleWheel(event) {
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

      event.preventDefault()

      if (event.altKey) {
        container.scrollTop += event.deltaY
        onScrollRef.current(container.scrollTop)
        return
      }

      const next = zoomAfterWheel(targetPxRef.current, event.deltaY, event.deltaMode)
      if (next === targetPxRef.current) return

      const pointerX = event.clientX - container.getBoundingClientRect().left
      anchorRef.current = { days: (container.scrollLeft + pointerX) / appliedPxRef.current, pointerX }
      targetPxRef.current = next
      onScaleChangeRef.current(next)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

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

  /** Ends a background pan gesture when the pointer is released. */
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
          <PatternDefs />
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
            const baseline = showBaseline && task.baseline ? baselineGeometry(task, calendar, startISO, pxPerDay) : null

            if (task.type === 'milestone') {
              return (
                <g key={task.id} data-task-id={task.id}>
                  {baseline && <BaselineBar x={baseline.x} width={0} rowTop={rowTop} />}
                  <MilestoneMarker
                    task={task}
                    x={barX}
                    rowTop={rowTop}
                    selected={task.id === selectedTaskId}
                    critical={critical}
                    showAssignee={showAssignee}
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
                {baseline && <BaselineBar x={baseline.x} width={baseline.width} rowTop={rowTop} />}
                <TaskBar
                  task={task}
                  x={barX}
                  width={endX - barX}
                  rowTop={rowTop}
                  selected={task.id === selectedTaskId}
                  critical={critical}
                  showAssignee={showAssignee}
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
