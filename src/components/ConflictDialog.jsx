import Dialog from './Dialog.jsx'

/**
 * Shown when a save is rejected because someone else (another tab, or
 * someone sharing the edit link) saved a newer version first. Offers
 * the three choices from the brief rather than silently overwriting
 * either copy. Deliberately cannot be dismissed with Escape or a
 * backdrop click, since one of the three choices has to be made for
 * the save conflict to actually resolve.
 * @param {object} props
 * @param {() => void} props.onKeepMine - overwrite the server with this browser's version
 * @param {() => void} props.onUseTheirs - discard local changes and load the server's version
 * @param {() => void} props.onDownloadMine - download this browser's version as a file first
 * @returns {JSX.Element} the conflict dialog
 */
function ConflictDialog({ onKeepMine, onUseTheirs, onDownloadMine }) {
  return (
    <Dialog open onClose={() => {}} label="Someone else saved a newer version" className="dialog--alert">
      <h2>Someone else saved a newer version</h2>
      <p>
        This chart changed on the server since you last loaded it, maybe from another tab or someone else with the
        edit link. Choose what to do, so nothing gets lost by accident.
      </p>
      <div className="dialog__actions dialog__actions--stacked">
        <button type="button" onClick={onDownloadMine}>
          Download my version first
        </button>
        <button type="button" onClick={onUseTheirs}>
          Use their version (lose my changes)
        </button>
        <button type="button" className="dialog__primary" onClick={onKeepMine}>
          Keep my version (overwrite theirs)
        </button>
      </div>
    </Dialog>
  )
}

export default ConflictDialog
