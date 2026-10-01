/**
 * The two-tier sticky header above the timeline grid: a coarse row
 * (months, say) above a fine row (weeks), each built from pre-computed
 * ticks so the header never has to repeat the grid's own date maths.
 * @param {object} props
 * @param {number} props.width - the total header width in pixels, matching the grid below
 * @param {{x: number, width: number, label: string}[]} props.minorTicks - the fine-grained tier's ticks
 * @param {{x: number, width: number, label: string}[]} props.majorTicks - the coarse tier's ticks
 * @returns {JSX.Element} the timeline header
 */
function TimelineHeader({ width, minorTicks, majorTicks }) {
  return (
    <div className="timeline-header" style={{ width }}>
      <div className="timeline-header__tier timeline-header__tier--major">
        {majorTicks.map((tick) => (
          <div
            key={tick.label + tick.x}
            className="timeline-header__cell"
            style={{ left: tick.x, width: tick.width }}
          >
            {tick.label}
          </div>
        ))}
      </div>
      <div className="timeline-header__tier timeline-header__tier--minor">
        {minorTicks.map((tick) => (
          <div
            key={tick.label + tick.x}
            className="timeline-header__cell timeline-header__cell--minor"
            style={{ left: tick.x, width: tick.width }}
          >
            {tick.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default TimelineHeader
