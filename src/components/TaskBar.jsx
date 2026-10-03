import { CHART_COLOURS, ROW_HEIGHT, TASK_COLOUR_HEX } from '../lib/constants.js'

const BAR_INSET = 6
const BAR_HEIGHT = ROW_HEIGHT - BAR_INSET * 2
const GROUP_BAR_HEIGHT = 8
const GROUP_TICK_HEIGHT = 10

/**
 * One task bar on the timeline: a rounded rectangle with a darker
 * progress fill and a text label, or - for a group - a bracket shape
 * with downward ticks at each end instead of a filled bar, so groups
 * are distinguishable by shape and not only by colour.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Task} props.task - the task this bar represents
 * @param {number} props.x - the bar's left edge in pixels
 * @param {number} props.width - the bar's width in pixels
 * @param {number} props.rowTop - the top of this task's row in pixels
 * @param {boolean} props.selected - whether this task is selected
 * @param {boolean} props.critical - whether this task is on the critical path
 * @param {boolean} [props.showAssignee] - whether to write the assignee after the task name
 * @param {(taskId: string) => void} props.onSelect - called when the bar is clicked
 * @param {(event: import('react').PointerEvent, handle: 'move'|'resize-start'|'resize-end'|'percent', barWidth: number) => void} [props.onPointerDown] - called when a drag starts on the bar, one of its edge handles, or its percent handle
 * @param {(taskId: string, edge: 'start'|'end', event: import('react').PointerEvent) => void} [props.onConnectorPointerDown] - called when a drag starts on a connector dot, to begin creating a dependency
 * @returns {JSX.Element} the bar's SVG group
 */
function TaskBar({
  task,
  x,
  width,
  rowTop,
  selected,
  critical,
  showAssignee,
  onSelect,
  onPointerDown,
  onConnectorPointerDown,
}) {
  const barWidth = Math.max(width, 4)
  const who = showAssignee && task.assignee ? ` (${task.assignee})` : ''
  const label = `${task.name}${who}, ${task.percent}% complete`

  if (task.type === 'group') {
    const y = rowTop + (ROW_HEIGHT - GROUP_BAR_HEIGHT) / 2
    return (
      <g
        className={`task-bar task-bar--group${selected ? ' task-bar--selected' : ''}`}
        role="img"
        aria-label={label}
        tabIndex={0}
        onClick={() => onSelect(task.id)}
      >
        <path
          d={`M ${x} ${y} v ${GROUP_TICK_HEIGHT} M ${x} ${y} h ${barWidth} M ${x + barWidth} ${y} v ${GROUP_TICK_HEIGHT}`}
          className={`task-bar__group-shape task-bar__group-shape--${task.colour}`}
          stroke={TASK_COLOUR_HEX[task.colour]}
        />
        <text
          x={x + barWidth + 6}
          y={rowTop + ROW_HEIGHT / 2}
          className="task-bar__label"
          fill={CHART_COLOURS.text}
        >
          {task.name}{who} ({task.percent}%)
        </text>
      </g>
    )
  }

  const y = rowTop + BAR_INSET
  const fillWidth = Math.max(0, Math.min(barWidth, (barWidth * task.percent) / 100))

  return (
    <g
      className={`task-bar${selected ? ' task-bar--selected' : ''}${critical ? ' task-bar--critical' : ''}`}
      role="img"
      aria-label={label}
      tabIndex={0}
      onClick={() => onSelect(task.id)}
      onPointerDown={(event) => onPointerDown?.(event, 'move', barWidth)}
    >
      <rect
        x={x}
        y={y}
        width={barWidth}
        height={BAR_HEIGHT}
        rx={4}
        className={`task-bar__shape task-bar__shape--${task.colour}`}
        fill={TASK_COLOUR_HEX[task.colour]}
      />
      <rect
        x={x}
        y={y}
        width={barWidth}
        height={BAR_HEIGHT}
        rx={4}
        className="task-bar__pattern"
        fill={`url(#bar-pattern-${task.colour})`}
      />
      <rect x={x} y={y} width={fillWidth} height={BAR_HEIGHT} rx={4} className="task-bar__progress" fill="rgba(0, 0, 0, 0.28)" />
      <text x={x + barWidth + 6} y={rowTop + ROW_HEIGHT / 2} className="task-bar__label" fill={CHART_COLOURS.text}>
        {task.name}
        {who}
      </text>
      <rect
        x={x - 3}
        y={y}
        width={6}
        height={BAR_HEIGHT}
        className="task-bar__handle task-bar__handle--start"
        fill="transparent"
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown?.(event, 'resize-start', barWidth)
        }}
      />
      <rect
        x={x + barWidth - 3}
        y={y}
        width={6}
        height={BAR_HEIGHT}
        className="task-bar__handle task-bar__handle--end"
        fill="transparent"
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown?.(event, 'resize-end', barWidth)
        }}
      />
      <rect
        x={x + fillWidth - 4}
        y={y + BAR_HEIGHT - 5}
        width={8}
        height={8}
        className="task-bar__percent-handle"
        opacity={0}
        aria-label={`${task.name} percent complete handle`}
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown?.(event, 'percent', barWidth)
        }}
      />
      <circle
        cx={x - 8}
        cy={rowTop + ROW_HEIGHT / 2}
        r={4}
        className="task-bar__connector"
        opacity={0}
        data-connector-task-id={task.id}
        data-connector-edge="start"
        aria-label={`Draw a dependency from the start of ${task.name}`}
        onPointerDown={(event) => {
          event.stopPropagation()
          onConnectorPointerDown?.(task.id, 'start', event)
        }}
      />
      <circle
        cx={x + barWidth + 8}
        cy={rowTop + ROW_HEIGHT / 2}
        r={4}
        className="task-bar__connector"
        opacity={0}
        data-connector-task-id={task.id}
        data-connector-edge="end"
        aria-label={`Draw a dependency from the end of ${task.name}`}
        onPointerDown={(event) => {
          event.stopPropagation()
          onConnectorPointerDown?.(task.id, 'end', event)
        }}
      />
    </g>
  )
}

export default TaskBar
