import { ROW_HEIGHT } from '../lib/constants.js'

const BASELINE_HEIGHT = 4
const MILESTONE_WIDTH = 8

/**
 * The thin grey bar drawn under a task to show where it was planned
 * to be when the baseline was saved. A milestone (no width) gets a
 * small tick instead.
 * @param {object} props
 * @param {number} props.x - the left edge in pixels
 * @param {number} props.width - the width in pixels (0 for a milestone)
 * @param {number} props.rowTop - the top of the task's row in pixels
 * @returns {JSX.Element} the baseline shape
 */
function BaselineBar({ x, width, rowTop }) {
  const isTick = width <= 0
  return (
    <rect
      className="baseline-bar"
      x={isTick ? x - MILESTONE_WIDTH / 2 : x}
      y={rowTop + ROW_HEIGHT - BASELINE_HEIGHT - 2}
      width={isTick ? MILESTONE_WIDTH : width}
      height={BASELINE_HEIGHT}
      rx={2}
      aria-hidden="true"
    />
  )
}

export default BaselineBar
