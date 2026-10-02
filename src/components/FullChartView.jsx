import { COLUMN_LABELS, ROW_HEIGHT } from '../lib/constants.js'
import { todayISO } from '../lib/dates.js'
import { computeEnd } from '../lib/scheduler.js'
import { buildHeaderTiers, computeDateRange, dateToX, pxPerDayFor } from '../lib/timelineScale.js'
import { flattenVisibleRows } from '../lib/taskTree.js'
import DependencyArrow from './DependencyArrow.jsx'
import MilestoneMarker from './MilestoneMarker.jsx'
import TaskBar from './TaskBar.jsx'
import TaskRow from './TaskRow.jsx'
import TimelineGrid from './TimelineGrid.jsx'
import TimelineHeader from './TimelineHeader.jsx'
import TodayLine from './TodayLine.jsx'

/** Does nothing; stands in for event handlers the read-only export view never needs. */
const noop = () => {}

/**
 * Renders the whole chart - every row, the whole date range - with no
 * scrolling and no windowing, for the print view and for PNG/PDF
 * export. The usual interactive editor uses windowed rendering and a
 * scrollable viewport; this component deliberately avoids both so
 * everything is present in the DOM at once to print or rasterise.
 * @param {object} props
 * @param {object} props.project - the project document to render
 * @returns {JSX.Element} the full, static chart
 */
function FullChartView({ project }) {
  const rows = flattenVisibleRows(project.tasks)
  const pxPerDay = pxPerDayFor(project.view.zoom)
  const tasks = rows.map((r) => r.task)
  const { startISO, endISO } = computeDateRange(tasks, project.calendar)
  const totalWidth = Math.max(dateToX(endISO, startISO, pxPerDay), 200)
  const totalHeight = Math.max(rows.length * ROW_HEIGHT, ROW_HEIGHT)
  const { minorTicks, majorTicks } = buildHeaderTiers(project.view.zoom, startISO, endISO, project.calendar.weekStartsOn)

  const tasksById = new Map(rows.map((r) => [r.task.id, r.task]))
  const rowTopByTaskId = new Map(rows.map((r, index) => [r.task.id, index * ROW_HEIGHT]))
  const predecessorsByTask = new Map()
  for (const dep of project.dependencies) {
    if (!predecessorsByTask.has(dep.to)) predecessorsByTask.set(dep.to, [])
    predecessorsByTask.get(dep.to).push(dep)
  }

  const today = todayISO()
  const todayX = dateToX(today, startISO, pxPerDay)
  const columns = project.view.columns.filter((c) => c !== 'name')

  return (
    <div className="full-chart">
      <h1 className="full-chart__title">{project.title}</h1>
      <div className="full-chart__body">
        <div className="full-chart__table" style={{ '--row-height': `${ROW_HEIGHT}px` }}>
          <div className="task-table__header" role="row">
            <div className="task-table__header-cell task-table__header-cell--name">Name</div>
            {columns.map((column) => (
              <div key={column} className="task-table__header-cell">
                {COLUMN_LABELS[column] ?? column}
              </div>
            ))}
          </div>
          {rows.map(({ task, depth, hasChildren }) => (
            <TaskRow
              key={task.id}
              task={task}
              depth={depth}
              hasChildren={hasChildren}
              columns={columns}
              selected={false}
              calendar={project.calendar}
              predecessorsByTask={predecessorsByTask}
              tasksById={tasksById}
              onSelect={noop}
              onToggleCollapse={noop}
              onRename={noop}
              onAssigneeChange={noop}
              onColourChange={noop}
              readOnly
            />
          ))}
        </div>

        <div className="full-chart__timeline">
          <TimelineHeader width={totalWidth} minorTicks={minorTicks} majorTicks={majorTicks} />
          <svg width={totalWidth} height={totalHeight} role="img" aria-label="Chart timeline">
            <TimelineGrid
              startISO={startISO}
              endISO={endISO}
              pxPerDay={pxPerDay}
              width={totalWidth}
              height={totalHeight}
              calendar={project.calendar}
              minorTicks={minorTicks}
            />
            <TodayLine x={todayX} height={totalHeight} />
            {project.dependencies.map((dep) => {
              const fromTask = tasksById.get(dep.from)
              const toTask = tasksById.get(dep.to)
              if (!fromTask || !toTask) return null
              return (
                <DependencyArrow
                  key={dep.id}
                  dependency={dep}
                  fromTask={fromTask}
                  toTask={toTask}
                  fromRowTop={rowTopByTaskId.get(dep.from)}
                  toRowTop={rowTopByTaskId.get(dep.to)}
                  startISO={startISO}
                  pxPerDay={pxPerDay}
                  calendar={project.calendar}
                  highlighted={false}
                  onSelect={noop}
                />
              )
            })}
            {rows.map(({ task }, index) => {
              const rowTop = index * ROW_HEIGHT
              const barX = dateToX(task.start, startISO, pxPerDay)

              if (task.type === 'milestone') {
                return (
                  <MilestoneMarker key={task.id} task={task} x={barX} rowTop={rowTop} selected={false} critical={false} onSelect={noop} />
                )
              }

              const endX = dateToX(computeEnd(task, project.calendar), startISO, pxPerDay) + pxPerDay
              return (
                <TaskBar
                  key={task.id}
                  task={task}
                  x={barX}
                  width={endX - barX}
                  rowTop={rowTop}
                  selected={false}
                  critical={false}
                  onSelect={noop}
                />
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}

export default FullChartView
