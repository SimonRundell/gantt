import { CHART_COLOURS } from '../lib/constants.js'

/**
 * A vertical line marking today's date on the timeline.
 * @param {object} props
 * @param {number} props.x - today's x position in pixels
 * @param {number} props.height - how tall the line should be
 * @returns {JSX.Element} the today line's SVG group
 */
function TodayLine({ x, height }) {
  return (
    <g className="today-line" aria-hidden="true">
      <line x1={x} x2={x} y1={0} y2={height} className="today-line__line" stroke={CHART_COLOURS.today} />
    </g>
  )
}

export default TodayLine
