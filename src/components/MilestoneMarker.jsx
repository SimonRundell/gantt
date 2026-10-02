import { ROW_HEIGHT } from '../lib/constants.js'

const SIZE = 10

/**
 * A milestone's diamond marker on the timeline. A milestone has no
 * duration, so its start and finish are the same point: it offers a
 * single connector dot rather than separate start/end ones.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Task} props.task - the milestone task
 * @param {number} props.x - the milestone's date in pixels along the timeline
 * @param {number} props.rowTop - the top of this task's row in pixels
 * @param {boolean} props.selected - whether this milestone is selected
 * @param {boolean} props.critical - whether this milestone is on the critical path
 * @param {boolean} [props.showAssignee] - whether to write the assignee after the milestone name
 * @param {(taskId: string) => void} props.onSelect - called when the marker is clicked
 * @param {(event: import('react').PointerEvent, handle: 'move') => void} [props.onPointerDown] - called when a drag starts on the marker
 * @param {(taskId: string, edge: 'start'|'end', event: import('react').PointerEvent) => void} [props.onConnectorPointerDown] - called when a drag starts on the connector dot
 * @returns {JSX.Element} the milestone's SVG group
 */
function MilestoneMarker({
  task,
  x,
  rowTop,
  selected,
  critical,
  showAssignee,
  onSelect,
  onPointerDown,
  onConnectorPointerDown,
}) {
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
        {showAssignee && task.assignee ? ` (${task.assignee})` : ''}
      </text>
      <circle
        cx={x - SIZE - 6}
        cy={centreY}
        r={4}
        className="task-bar__connector"
        data-connector-task-id={task.id}
        data-connector-edge="start"
        aria-label={`Draw a dependency from ${task.name}`}
        onPointerDown={(event) => {
          event.stopPropagation()
          onConnectorPointerDown?.(task.id, 'start', event)
        }}
      />
    </g>
  )
}

export default MilestoneMarker
