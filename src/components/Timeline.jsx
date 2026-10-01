import { useEffect, useRef } from 'react'
import { ROW_HEIGHT } from '../lib/constants.js'
import { useElementSize } from '../hooks/useElementSize.js'
import { useRowWindow } from '../hooks/useRowWindow.js'
import { computeEnd } from '../lib/scheduler.js'
import { buildHeaderTiers, computeDateRange, dateToX, pxPerDayFor, ZOOM_LEVELS } from '../lib/timelineScale.js'
import { todayISO } from '../lib/dates.js'
import MilestoneMarker from './MilestoneMarker.jsx'
import TaskBar from './TaskBar.jsx'
import TimelineGrid from './TimelineGrid.jsx'
import TimelineHeader from './TimelineHeader.jsx'
import TodayLine from './TodayLine.jsx'

const HEADER_HEIGHT = 48

/** @type {('day'|'week'|'month'|'quarter')[]} the zoom levels in order, for Ctrl+wheel cycling */
const ZOOM_ORDER = ['day', 'week', 'month', 'quarter']

/**
 * The SVG timeline on the right of the editor: header, background
 * grid, task bars, milestones, the today line, and (in a later phase)
 * dependency arrows. Vertical scroll stays in sync with the task
 * table via the shared scrollTop prop.
 * @param {object} props
 * @param {{task: import('../lib/scheduler.js').Task, depth: number, hasChildren: boolean}[]} props.rows - the visible rows, in the same order as the task table
 * @param {import('../lib/calendar.js').WorkingCalendar} props.calendar - the project's working calendar
 * @param {string} props.zoom - the current zoom level
 * @param {string|null} props.selectedTaskId - the currently selected task's id
 * @param {Set<string>} props.criticalTaskIds - ids of tasks on the critical path, when it is shown
 * @param {(taskId: string) => void} props.onSelect - called when a bar or milestone is selected
 * @param {number} props.scrollTop - the vertical scroll offset to apply, kept in sync with the table
 * @param {(scrollTop: number) => void} props.onScroll - called when the timeline is scrolled vertically
 * @param {(zoom: string) => void} props.onZoomChange - called when Ctrl+wheel changes the zoom level
 * @param {(taskId: string, event: import('react').PointerEvent, handle: string) => void} [props.onBarPointerDown] - called when a drag starts on a bar
 * @param {import('react').Ref<{scrollToToday: () => void}>} [props.scrollApiRef] - exposes a scrollToToday method to the parent
 * @returns {JSX.Element} the timeline pane
 */
function Timeline({
  rows,
  calendar,
  zoom,
  selectedTaskId,
  criticalTaskIds,
  onSelect,
  scrollTop,
  onScroll,
  onZoomChange,
  onBarPointerDown,
  scrollApiRef,
}) {
  const scrollRef = useRef(null)
  const { height: viewportHeight } = useElementSize(scrollRef)
  const pxPerDay = pxPerDayFor(zoom)
  const tasks = rows.map((r) => r.task)
  const { startISO, endISO } = computeDateRange(tasks, calendar)
  const totalWidth = dateToX(endISO, startISO, pxPerDay)
  const totalHeight = rows.length * ROW_HEIGHT
  const { minorTicks, majorTicks } = buildHeaderTiers(zoom, startISO, endISO, calendar.weekStartsOn)

  const { startIndex, endIndex } = useRowWindow(scrollTop, viewportHeight, rows.length, ROW_HEIGHT)
  const visibleRows = rows.slice(startIndex, endIndex)

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
          className="timeline__svg"
          width={totalWidth}
          height={totalHeight}
          role="group"
          aria-label="Chart timeline"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={handleBackgroundPointerUp}
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
          {visibleRows.map(({ task }, index) => {
            const rowTop = (startIndex + index) * ROW_HEIGHT
            const barX = dateToX(task.start, startISO, pxPerDay)
            const critical = criticalTaskIds?.has(task.id) ?? false

            if (task.type === 'milestone') {
              return (
                <MilestoneMarker
                  key={task.id}
                  task={task}
                  x={barX}
                  rowTop={rowTop}
                  selected={task.id === selectedTaskId}
                  critical={critical}
                  onSelect={onSelect}
                  onPointerDown={(event, handle) => onBarPointerDown?.(task.id, event, handle)}
                />
              )
            }

            const endX = dateToX(computeEnd(task, calendar), startISO, pxPerDay) + pxPerDay
            return (
              <TaskBar
                key={task.id}
                task={task}
                x={barX}
                width={endX - barX}
                rowTop={rowTop}
                selected={task.id === selectedTaskId}
                critical={critical}
                onSelect={onSelect}
                onPointerDown={(event, handle) => onBarPointerDown?.(task.id, event, handle)}
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default Timeline
export { HEADER_HEIGHT, ZOOM_LEVELS }
