import { addCalendarDays, calendarDaysBetween } from '../lib/dates.js'
import { isWorkingDay } from '../lib/calendar.js'
import { dateToX } from '../lib/timelineScale.js'
import { CHART_COLOURS } from '../lib/constants.js'

/**
 * The timeline's background layer: a shaded column behind every
 * non-working day and a vertical line at every minor tick boundary,
 * drawn once behind the bars.
 * @param {object} props
 * @param {string} props.startISO - the timeline's range start date
 * @param {string} props.endISO - the timeline's range end date
 * @param {number} props.pxPerDay - pixels per calendar day at the current zoom
 * @param {number} props.width - total grid width in pixels
 * @param {number} props.height - total grid height in pixels
 * @param {import('../lib/calendar.js').WorkingCalendar} props.calendar - the project's working calendar
 * @param {{x: number}[]} props.minorTicks - the header's fine-grained ticks, used for vertical grid lines
 * @returns {JSX.Element} the grid's SVG group
 */
function TimelineGrid({ startISO, endISO, pxPerDay, width, height, calendar, minorTicks }) {
  const totalDays = calendarDaysBetween(startISO, endISO)
  const nonWorkingRects = []

  for (let i = 0; i < totalDays; i++) {
    const day = addCalendarDays(startISO, i)
    if (!isWorkingDay(day, calendar)) {
      nonWorkingRects.push({ x: dateToX(day, startISO, pxPerDay), key: day })
    }
  }

  return (
    <g className="timeline-grid">
      {nonWorkingRects.map((rect) => (
        <rect
          key={rect.key}
          x={rect.x}
          y={0}
          width={pxPerDay}
          height={height}
          className="timeline-grid__non-working"
          fill={CHART_COLOURS.nonWorking}
        />
      ))}
      {minorTicks.map((tick) => (
        <line
          key={`line-${tick.x}`}
          x1={tick.x}
          x2={tick.x}
          y1={0}
          y2={height}
          className="timeline-grid__line"
          stroke={CHART_COLOURS.gridLine}
        />
      ))}
      <line
        x1={0}
        x2={width}
        y1={height}
        y2={height}
        className="timeline-grid__line"
        stroke={CHART_COLOURS.gridLine}
      />
    </g>
  )
}

export default TimelineGrid
