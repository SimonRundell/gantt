import { ROW_HEIGHT } from '../lib/constants.js'

const SIZE = 10

/**
 * A milestone's diamond marker on the timeline.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Task} props.task - the milestone task
 * @param {number} props.x - the milestone's date in pixels along the timeline
 * @param {number} props.rowTop - the top of this task's row in pixels
 * @param {boolean} props.selected - whether this milestone is selected
 * @param {boolean} props.critical - whether this milestone is on the critical path
 * @param {(taskId: string) => void} props.onSelect - called when the marker is clicked
 * @param {(event: import('react').PointerEvent, handle: 'move') => void} [props.onPointerDown] - called when a drag starts on the marker
 * @returns {JSX.Element} the milestone's SVG group
 */
function MilestoneMarker({ task, x, rowTop, selected, critical, onSelect, onPointerDown }) {
  const centreY = rowTop + ROW_HEIGHT / 2
  const points = [
    `${x},${centreY - SIZE}`,
    `${x + SIZE},${centreY}`,
    `${x},${centreY + SIZE}`,
    `${x - SIZE},${centreY}`,
  ].join(' ')

  return (
    <g
      className={`milestone-marker${selected ? ' milestone-marker--selected' : ''}${critical ? ' milestone-marker--critical' : ''}`}
      role="img"
      aria-label={`${task.name}, milestone`}
      tabIndex={0}
      onClick={() => onSelect(task.id)}
      onPointerDown={(event) => onPointerDown?.(event, 'move')}
    >
      <polygon points={points} className={`milestone-marker__shape milestone-marker__shape--${task.colour}`} />
      <text x={x + SIZE + 6} y={centreY} className="task-bar__label">
        {task.name}
      </text>
    </g>
  )
}

export default MilestoneMarker
