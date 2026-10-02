import { formatUKDate } from '../lib/dates.js'
import { summariseResources } from '../lib/resources.js'
import Dialog from './Dialog.jsx'

/**
 * Describes one overlapping pair of tasks in plain words.
 * @param {import('../lib/resources.js').ResourceTask[]} pair - the two overlapping tasks
 * @returns {string} for example "Build login (05/10/2026 to 07/10/2026) and Write tests (06/10/2026 to 08/10/2026)"
 */
function describePair([a, b]) {
  return `${a.name} (${formatUKDate(a.start)} to ${formatUKDate(a.end)}) and ${b.name} (${formatUKDate(b.start)} to ${formatUKDate(b.end)})`
}

/**
 * A simple workload summary: each person with their number of tasks,
 * and a warning when they have tasks that overlap in time.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Task[]} props.tasks - every task in the project
 * @param {import('../lib/calendar.js').WorkingCalendar} props.calendar - the working calendar
 * @param {() => void} props.onClose - called when the dialog is closed
 * @returns {JSX.Element} the resources dialog
 */
function ResourcesDialog({ tasks, calendar, onClose }) {
  const { people, unassignedCount } = summariseResources(tasks, calendar)

  return (
    <Dialog open onClose={onClose} label="Resources" className="resources-dialog">
      <h2>Resources</h2>

      {people.length === 0 ? (
        <p>
          Nobody is assigned to a task yet. Type a name into the Assignee column or the task details panel. Separate names
          with commas to share a task.
        </p>
      ) : (
        <table className="resources-table">
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Tasks</th>
              <th scope="col">Not finished</th>
              <th scope="col">Overlaps</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.name}>
                <th scope="row">{person.name}</th>
                <td>{person.tasks.length}</td>
                <td>{person.openCount}</td>
                <td>
                  {person.overlaps.length === 0 ? (
                    'None'
                  ) : (
                    <details className="resources-table__warning">
                      <summary>
                        <span aria-hidden="true">&#9888; </span>
                        {person.overlaps.length} overlapping {person.overlaps.length === 1 ? 'pair' : 'pairs'}
                      </summary>
                      <ul>
                        {person.overlaps.map((pair) => (
                          <li key={`${pair[0].id}-${pair[1].id}`}>{describePair(pair)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {unassignedCount > 0 && (
        <p className="resources-dialog__unassigned">
          {unassignedCount} {unassignedCount === 1 ? 'task has' : 'tasks have'} nobody assigned.
        </p>
      )}

      <div className="dialog__actions">
        <button type="button" className="dialog__primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  )
}

export default ResourcesDialog
