import { COLUMN_LABELS } from '../lib/constants.js'
import Dialog from './Dialog.jsx'

/** @type {string[]} the columns that can be turned on or off, in the order they appear (the name column is always shown) */
const OPTIONAL_COLUMNS = Object.keys(COLUMN_LABELS).filter((column) => column !== 'name')

/**
 * Dialog for choosing which columns the task table shows, and whether
 * assignees are written on the chart bars. Changes apply straight away.
 * @param {object} props
 * @param {string[]} props.columns - the columns currently shown
 * @param {boolean} props.showAssigneeOnBars - whether bar labels include the assignee
 * @param {(columns: string[]) => void} props.onColumnsChange - called with the new list of columns
 * @param {(show: boolean) => void} props.onShowAssigneeChange - called when the bar label option changes
 * @param {() => void} props.onClose - called when the dialog is closed
 * @returns {JSX.Element} the columns dialog
 */
function ColumnsDialog({ columns, showAssigneeOnBars, onColumnsChange, onShowAssigneeChange, onClose }) {
  /**
   * Turns one column on or off, keeping the columns in their usual order.
   * @param {string} column - the column to toggle
   * @returns {void}
   */
  function toggle(column) {
    const next = columns.includes(column) ? columns.filter((c) => c !== column) : [...columns, column]
    onColumnsChange(OPTIONAL_COLUMNS.filter((c) => next.includes(c)))
  }

  return (
    <Dialog open onClose={onClose} label="Choose columns">
      <h2>Columns</h2>
      <fieldset className="dialog__field">
        <legend>Show in the task table</legend>
        <label>
          <input type="checkbox" checked disabled /> Name (always shown)
        </label>
        {OPTIONAL_COLUMNS.map((column) => (
          <label key={column}>
            <input type="checkbox" checked={columns.includes(column)} onChange={() => toggle(column)} />{' '}
            {COLUMN_LABELS[column]}
            {column === 'variance' && ' (days later or earlier than the baseline)'}
          </label>
        ))}
      </fieldset>

      <fieldset className="dialog__field">
        <legend>On the chart</legend>
        <label>
          <input
            type="checkbox"
            checked={showAssigneeOnBars}
            onChange={(event) => onShowAssigneeChange(event.target.checked)}
          />{' '}
          Show the assignee after the task name
        </label>
      </fieldset>

      <div className="dialog__actions">
        <button type="button" className="dialog__primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  )
}

export default ColumnsDialog
