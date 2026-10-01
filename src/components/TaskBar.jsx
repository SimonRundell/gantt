import { ROW_HEIGHT } from '../lib/constants.js'

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
 * @param {(taskId: string) => void} props.onSelect - called when the bar is clicked
 * @param {(event: import('react').PointerEvent, handle: 'move'|'resize-start'|'resize-end') => void} [props.onPointerDown] - called when a drag starts on the bar or one of its edge handles
 * @returns {JSX.Element} the bar's SVG group
 */
function TaskBar({ task, x, width, rowTop, selected, critical, onSelect, onPointerDown }) {
  const barWidth = Math.max(width, 4)
  const label = `${task.name}, ${task.percent}% complete`

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
        />
        <text x={x + barWidth + 6} y={rowTop + ROW_HEIGHT / 2} className="task-bar__label">
          {task.name} ({task.percent}%)
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
      onPointerDown={(event) => onPointerDown?.(event, 'move')}
    >
      <rect
        x={x}
        y={y}
        width={barWidth}
        height={BAR_HEIGHT}
        rx={4}
        className={`task-bar__shape task-bar__shape--${task.colour}`}
      />
      <rect x={x} y={y} width={fillWidth} height={BAR_HEIGHT} rx={4} className="task-bar__progress" />
      <text x={x + barWidth + 6} y={rowTop + ROW_HEIGHT / 2} className="task-bar__label">
        {task.name}
      </text>
      <rect
        x={x - 3}
        y={y}
        width={6}
        height={BAR_HEIGHT}
        className="task-bar__handle task-bar__handle--start"
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown?.(event, 'resize-start')
        }}
      />
      <rect
        x={x + barWidth - 3}
        y={y}
        width={6}
        height={BAR_HEIGHT}
        className="task-bar__handle task-bar__handle--end"
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown?.(event, 'resize-end')
        }}
      />
    </g>
  )
}

export default TaskBar
