import { formatUKDate } from '../lib/dates.js'

/**
 * The thin status bar along the bottom of the editor: details of the
 * selected task, the overall project span, and a task count.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Task|null} props.selectedTask - the currently selected task, if any
 * @param {string|null} props.selectedTaskEnd - the selected task's computed end date, if any
 * @param {string|null} props.projectStart - the earliest task start in the project
 * @param {string|null} props.projectEnd - the latest task end in the project
 * @param {number} props.taskCount - the total number of tasks
 * @returns {JSX.Element} the status bar
 */
function StatusBar({ selectedTask, selectedTaskEnd, projectStart, projectEnd, taskCount }) {
  return (
    <div className="status-bar" role="status">
      <span className="status-bar__selection">
        {selectedTask
          ? `${selectedTask.name}: ${formatUKDate(selectedTask.start)} to ${formatUKDate(selectedTaskEnd)}, ${selectedTask.percent}% complete`
          : 'No task selected'}
      </span>
      <span className="status-bar__span">
        {projectStart && projectEnd
          ? `Project: ${formatUKDate(projectStart)} to ${formatUKDate(projectEnd)}`
          : 'Project: no tasks yet'}
      </span>
      <span className="status-bar__count">{taskCount} task{taskCount === 1 ? '' : 's'}</span>
    </div>
  )
}

export default StatusBar
