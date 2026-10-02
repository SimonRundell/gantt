import Dialog from './Dialog.jsx'

/** @type {{keys: string, description: string}[]} every keyboard shortcut the editor supports */
const SHORTCUTS = [
  { keys: 'Ctrl+Z', description: 'Undo' },
  { keys: 'Ctrl+Y or Ctrl+Shift+Z', description: 'Redo' },
  { keys: 'Delete or Backspace', description: 'Delete the selected task' },
  { keys: 'Enter or Space', description: 'Select the focused task row' },
  { keys: 'F2, or Enter on a selected row', description: 'Rename the selected task' },
  { keys: 'Tab / Shift+Tab', description: 'Move focus between controls' },
  { keys: 'Esc', description: 'Close the open dialog' },
  { keys: 'Scroll wheel over the timeline', description: 'Zoom in or out around the pointer' },
  { keys: 'Shift + scroll wheel', description: 'Scroll the timeline sideways' },
  { keys: 'Alt + scroll wheel', description: 'Scroll the timeline up and down the rows' },
  { keys: '?', description: 'Show this list' },
]

/**
 * A dialog listing every keyboard shortcut, opened with the `?` key
 * or from the toolbar.
 * @param {{onClose: () => void}} props
 * @returns {JSX.Element} the shortcuts dialog
 */
function ShortcutsDialog({ onClose }) {
  return (
    <Dialog open onClose={onClose} label="Keyboard shortcuts">
      <h2>Keyboard shortcuts</h2>
      <table className="shortcuts-table">
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.keys}>
              <td>
                <kbd>{s.keys}</kbd>
              </td>
              <td>{s.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="dialog__close" onClick={onClose}>
        Close
      </button>
    </Dialog>
  )
}

export default ShortcutsDialog
