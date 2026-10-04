import { useId } from 'react'
import Dialog from './Dialog.jsx'

/**
 * Dialog for filtering the task table and timeline to a single
 * assignee and/or a date range. Viewing only: it never changes what
 * is saved, printed or exported, and changes apply straight away.
 * @param {object} props
 * @param {string[]} props.assigneeOptions - the distinct assignee names to choose from
 * @param {string} props.assignee - the currently chosen assignee, or '' for everyone
 * @param {(assignee: string) => void} props.onAssigneeChange - called with the new assignee filter
 * @param {string} props.fromISO - the date window's start, or '' for no lower bound
 * @param {(fromISO: string) => void} props.onFromChange - called with the new lower bound
 * @param {string} props.toISO - the date window's end, or '' for no upper bound
 * @param {(toISO: string) => void} props.onToChange - called with the new upper bound
 * @param {number} props.shownCount - how many tasks the current filter shows
 * @param {number} props.totalCount - how many tasks the project has in total
 * @param {() => void} props.onClear - called to turn every filter off
 * @param {() => void} props.onClose - called when the dialog is closed
 * @returns {JSX.Element} the filter dialog
 */
function FilterDialog({
  assigneeOptions,
  assignee,
  onAssigneeChange,
  fromISO,
  onFromChange,
  toISO,
  onToChange,
  shownCount,
  totalCount,
  onClear,
  onClose,
}) {
  const hasFilter = assignee !== '' || fromISO !== '' || toISO !== ''
  const fromId = useId()
  const toId = useId()

  return (
    <Dialog open onClose={onClose} label="Filter tasks">
      <h2>Filter</h2>
      <p className="dialog__hint">
        Hides tasks from the table and timeline on your screen only. It does not change what is saved, printed or
        exported.
      </p>

      <label className="dialog__field filter-dialog__row">
        Assignee
        <select value={assignee} onChange={(event) => onAssigneeChange(event.target.value)}>
          <option value="">Everyone</option>
          {assigneeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="dialog__field">
        <legend>Date range</legend>
        <div className="filter-dialog__date-grid">
          <label htmlFor={fromId}>From</label>
          <input id={fromId} type="date" value={fromISO} onChange={(event) => onFromChange(event.target.value)} />
          <label htmlFor={toId}>To</label>
          <input id={toId} type="date" value={toISO} onChange={(event) => onToChange(event.target.value)} />
        </div>
      </fieldset>

      <p className="dialog__hint">
        Showing {shownCount} of {totalCount} task{totalCount === 1 ? '' : 's'}.
      </p>

      <div className="dialog__actions">
        <button type="button" onClick={onClear} disabled={!hasFilter}>
          Clear filters
        </button>
        <button type="button" className="dialog__primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  )
}

export default FilterDialog
