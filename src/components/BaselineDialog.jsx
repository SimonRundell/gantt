import Dialog from './Dialog.jsx'

/**
 * Dialog for saving the current plan as a baseline, showing or hiding
 * it on the chart, or clearing it. A baseline is a snapshot of every
 * task's start and duration, drawn as a thin grey bar under each task
 * so you can see how far the plan has drifted.
 * @param {object} props
 * @param {boolean} props.hasBaseline - whether any task has a saved baseline
 * @param {boolean} props.showBaseline - whether the baseline is currently drawn on the chart
 * @param {boolean} props.readOnly - when true the baseline can be shown or hidden but not changed
 * @param {() => void} props.onSet - called to save the current plan as the baseline
 * @param {() => void} props.onClear - called to remove the baseline
 * @param {() => void} props.onToggleShow - called to show or hide the baseline
 * @param {() => void} props.onClose - called when the dialog is closed
 * @returns {JSX.Element} the baseline dialog
 */
function BaselineDialog({ hasBaseline, showBaseline, readOnly, onSet, onClear, onToggleShow, onClose }) {
  return (
    <Dialog open onClose={onClose} label="Baseline">
      <h2>Baseline</h2>
      <p>
        A baseline is a snapshot of your plan as it stands now. Once saved, each task shows a thin grey bar for where it
        was planned, and the Variance column (see Columns) shows how many working days later or earlier it now finishes.
      </p>

      <p className="dialog__notice">
        {hasBaseline
          ? 'A baseline is saved. Saving again replaces it with the current plan.'
          : 'No baseline saved yet.'}
      </p>

      {hasBaseline && (
        <label className="dialog__field">
          <input type="checkbox" checked={showBaseline} onChange={onToggleShow} /> Show the baseline on the chart
        </label>
      )}

      <div className="dialog__actions dialog__actions--stacked">
        <button type="button" className="dialog__primary" disabled={readOnly} onClick={onSet}>
          {hasBaseline ? 'Replace baseline with the current plan' : 'Save the current plan as the baseline'}
        </button>
        {hasBaseline && (
          <button type="button" className="btn btn--danger" disabled={readOnly} onClick={onClear}>
            Clear the baseline
          </button>
        )}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  )
}

export default BaselineDialog
