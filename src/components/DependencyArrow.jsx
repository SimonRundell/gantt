import { CHART_COLOURS, ROW_HEIGHT } from '../lib/constants.js'
import { dateToX } from '../lib/timelineScale.js'
import { computeEnd } from '../lib/scheduler.js'

const STUB = 10
const ARROW_SIZE = 5

/**
 * Works out which x edge of a task's bar a dependency attaches to.
 * @param {import('../lib/scheduler.js').Task} task - the task
 * @param {'start'|'end'} edge - which edge of the bar
 * @param {string} startISO - the timeline's range start date
 * @param {number} pxPerDay - pixels per calendar day at the current zoom
 * @param {import('../lib/calendar.js').WorkingCalendar} calendar - the project's working calendar
 * @returns {number} the x position of that edge
 */
function edgeX(task, edge, startISO, pxPerDay, calendar) {
  if (edge === 'end') {
    return dateToX(computeEnd(task, calendar), startISO, pxPerDay) + pxPerDay
  }
  return dateToX(task.start, startISO, pxPerDay)
}

/**
 * One dependency arrow: an orthogonal (elbow) path from a
 * predecessor's finish or start edge to a successor's start or
 * finish edge, with a small arrowhead, routed with a short stub away
 * from each bar so it doesn't run straight through either one.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Dependency} props.dependency - the dependency this arrow represents
 * @param {import('../lib/scheduler.js').Task} props.fromTask - the predecessor task
 * @param {import('../lib/scheduler.js').Task} props.toTask - the successor task
 * @param {number} props.fromRowTop - the predecessor's row top in pixels
 * @param {number} props.toRowTop - the successor's row top in pixels
 * @param {string} props.startISO - the timeline's range start date
 * @param {number} props.pxPerDay - pixels per calendar day at the current zoom
 * @param {import('../lib/calendar.js').WorkingCalendar} props.calendar - the project's working calendar
 * @param {boolean} props.highlighted - whether this arrow should be drawn highlighted
 * @param {(dependencyId: string, event: import('react').MouseEvent) => void} props.onSelect - called when the arrow is clicked
 * @returns {JSX.Element} the dependency arrow's SVG group
 */
function DependencyArrow({
  dependency,
  fromTask,
  toTask,
  fromRowTop,
  toRowTop,
  startISO,
  pxPerDay,
  calendar,
  highlighted,
  onSelect,
}) {
  const fromEdge = dependency.type[0] === 'F' ? 'end' : 'start'
  const toEdge = dependency.type[1] === 'S' ? 'start' : 'end'

  const fromX = edgeX(fromTask, fromEdge, startISO, pxPerDay, calendar)
  const toX = edgeX(toTask, toEdge, startISO, pxPerDay, calendar)
  const fromY = fromRowTop + ROW_HEIGHT / 2
  const toY = toRowTop + ROW_HEIGHT / 2

  const fromStubX = fromEdge === 'end' ? fromX + STUB : fromX - STUB
  const toStubX = toEdge === 'end' ? toX + STUB : toX - STUB

  const path = `M ${fromX} ${fromY} L ${fromStubX} ${fromY} L ${fromStubX} ${toY} L ${toStubX} ${toY} L ${toX} ${toY}`

  const arrowDirection = toEdge === 'start' ? 1 : -1
  const arrowPoints = [
    `${toX},${toY}`,
    `${toX - arrowDirection * ARROW_SIZE},${toY - ARROW_SIZE}`,
    `${toX - arrowDirection * ARROW_SIZE},${toY + ARROW_SIZE}`,
  ].join(' ')

  return (
    <g
      className={`dependency-arrow${highlighted ? ' dependency-arrow--highlighted' : ''}`}
      role="img"
      aria-label={`${fromTask.name} to ${toTask.name}, ${dependency.type} dependency${dependency.lagDays ? `, ${dependency.lagDays} day lag` : ''}`}
      tabIndex={0}
      onClick={(event) => onSelect(dependency.id, event)}
    >
      <path d={path} className="dependency-arrow__hit" fill="none" />
      <path d={path} className="dependency-arrow__line" fill="none" stroke={CHART_COLOURS.textMuted} strokeWidth={1.5} />
      <polygon points={arrowPoints} className="dependency-arrow__head" fill={CHART_COLOURS.textMuted} />
    </g>
  )
}

export default DependencyArrow
