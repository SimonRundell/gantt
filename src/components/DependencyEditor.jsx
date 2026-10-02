import Dialog from './Dialog.jsx'

/** @type {{value: string, label: string}[]} the four dependency types, in the order offered in the editor */
const DEPENDENCY_TYPES = [
  { value: 'FS', label: 'Finish to Start' },
  { value: 'SS', label: 'Start to Start' },
  { value: 'FF', label: 'Finish to Finish' },
  { value: 'SF', label: 'Start to Finish' },
]

/**
 * A small dialog for editing or removing the selected dependency: its
 * type, its lag in working days (negative allowed), or deleting it
 * outright.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Dependency} props.dependency - the dependency being edited
 * @param {import('../lib/scheduler.js').Task|undefined} props.fromTask - the predecessor task
 * @param {import('../lib/scheduler.js').Task|undefined} props.toTask - the successor task
 * @param {(type: string) => void} props.onChangeType - called when the dependency type is changed
 * @param {(lagDays: number) => void} props.onChangeLag - called when the lag is changed
 * @param {() => void} props.onDelete - called when the dependency should be removed
 * @param {() => void} props.onClose - called to close the dialog without deleting
 * @returns {JSX.Element} the dependency editor dialog
 */
function DependencyEditor({ dependency, fromTask, toTask, onChangeType, onChangeLag, onDelete, onClose }) {
  return (
    <Dialog open onClose={onClose} label="Edit dependency" className="dependency-editor">
      <button type="button" className="dependency-editor__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="dependency-editor__summary">
        {fromTask?.name ?? 'Unknown task'} → {toTask?.name ?? 'Unknown task'}
      </p>
      <label className="dependency-editor__field">
        Type
        <select value={dependency.type} onChange={(event) => onChangeType(event.target.value)}>
          {DEPENDENCY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="dependency-editor__field">
        Lag (working days)
        <input
          type="number"
          value={dependency.lagDays}
          onChange={(event) => onChangeLag(Number(event.target.value) || 0)}
        />
      </label>
      <button type="button" className="dependency-editor__delete" onClick={onDelete}>
        Delete dependency
      </button>
    </Dialog>
  )
}

export default DependencyEditor
