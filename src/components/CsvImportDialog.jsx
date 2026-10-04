import Dialog from './Dialog.jsx'

/**
 * Shown after a CSV or Microsoft Project XML file is chosen in the
 * editor. If the file could not be read it explains why; otherwise it
 * says what was found, lists anything that was fixed or ignored, and
 * asks whether to add the tasks to this chart or replace what is there.
 * @param {object} props
 * @param {string} props.fileName - the name of the chosen file
 * @param {string} props.formatLabel - the file format, for the dialog's heading (for example "CSV" or "Microsoft Project XML")
 * @param {import('../lib/csvTasks.js').CsvImportResult} props.result - what was read from the file
 * @param {() => void} props.onAppend - add the tasks after the existing ones
 * @param {() => void} props.onReplace - replace every task in the chart with the imported ones
 * @param {() => void} props.onCancel - close without importing
 * @returns {JSX.Element} the import dialog
 */
function CsvImportDialog({ fileName, formatLabel, result, onAppend, onReplace, onCancel }) {
  const failed = result.errors.length > 0

  return (
    <Dialog open onClose={onCancel} label={`Import tasks from ${formatLabel}`} className="csv-dialog">
      <h2>Import from {formatLabel}</h2>
      <p className="csv-dialog__file">{fileName}</p>

      {failed ? (
        <>
          <p className="calendar-dialog__error" role="alert">
            This file could not be imported.
          </p>
          <ul className="csv-dialog__list">
            {result.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <div className="dialog__actions">
            <button type="button" className="dialog__primary" onClick={onCancel}>
              Close
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Found <strong>{result.tasks.length}</strong> {result.tasks.length === 1 ? 'task' : 'tasks'} and{' '}
            <strong>{result.dependencies.length}</strong>{' '}
            {result.dependencies.length === 1 ? 'dependency' : 'dependencies'}.
          </p>

          {result.warnings.length > 0 && (
            <>
              <p className="dialog__notice">Some things were fixed or ignored:</p>
              <ul className="csv-dialog__list">
                {result.warnings.map((message, index) => (
                  <li key={`${index}-${message}`}>{message}</li>
                ))}
              </ul>
            </>
          )}

          <div className="dialog__actions dialog__actions--stacked">
            <button type="button" className="dialog__primary" onClick={onAppend}>
              Add to the end of this chart
            </button>
            <button type="button" className="btn btn--danger" onClick={onReplace}>
              Replace every task in this chart
            </button>
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
          <p className="csv-dialog__hint">Either choice can be undone with Undo.</p>
        </>
      )}
    </Dialog>
  )
}

export default CsvImportDialog
