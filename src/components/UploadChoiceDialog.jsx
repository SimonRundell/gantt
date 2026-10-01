/**
 * Shown after a valid `.json` file is uploaded into the editor, so a
 * student never has their current work silently overwritten.
 * @param {object} props
 * @param {string} props.fileTitle - the title found inside the uploaded file
 * @param {() => void} props.onOpenAsNew - open the uploaded file as a brand new chart
 * @param {() => void} props.onReplace - replace the current chart's content with the uploaded file
 * @param {() => void} props.onCancel - cancel without doing either
 * @returns {JSX.Element} the upload choice dialog
 */
function UploadChoiceDialog({ fileTitle, onOpenAsNew, onReplace, onCancel }) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Open uploaded file"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Open "{fileTitle}"</h2>
        <p>This file looks like a valid Gantt chart. What would you like to do with it?</p>
        <div className="dialog__actions dialog__actions--stacked">
          <button type="button" className="dialog__primary" onClick={onOpenAsNew}>
            Open as a new chart
          </button>
          <button type="button" onClick={onReplace}>
            Replace the current chart
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadChoiceDialog
