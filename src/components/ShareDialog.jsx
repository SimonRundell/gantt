import { useId, useState } from 'react'
import Dialog from './Dialog.jsx'

/**
 * A dialog showing a project's edit and view links, with copy
 * buttons and the standard privacy notice. Shown automatically the
 * first time a new project is saved, and reachable afterwards from
 * the toolbar's Share button.
 * @param {object} props
 * @param {string} props.editLink - the full edit link, including the token
 * @param {string} props.viewLink - the full read-only link
 * @param {() => void} props.onClose - called when the dialog should close
 * @returns {JSX.Element} the share dialog
 */
function ShareDialog({ editLink, viewLink, onClose }) {
  const [copied, setCopied] = useState(null)
  const editId = useId()
  const viewId = useId()

  /**
   * Copies a link to the clipboard, wrapped in try/catch since the
   * Clipboard API can be unavailable or blocked.
   * @param {string} link - the link to copy
   * @param {string} label - which link this is, for the "copied" feedback
   * @returns {Promise<void>} resolves once the copy attempt finishes
   */
  async function copyLink(link, label) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard access can be denied; the link is still shown and selectable by hand.
    }
  }

  return (
    <Dialog open onClose={onClose} label="Share this chart">
      <h2>Share this chart</h2>
      <p className="dialog__notice">
        Anyone with the edit link can change this chart. Do not put personal details in it.
      </p>

      <div className="dialog__field">
        <label htmlFor={editId}>Edit link (can change the chart)</label>
        <div className="dialog__link-row">
          <input id={editId} readOnly value={editLink} onFocus={(event) => event.target.select()} />
          <button type="button" onClick={() => copyLink(editLink, 'edit')}>
            {copied === 'edit' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="dialog__field">
        <label htmlFor={viewId}>View link (read only)</label>
        <div className="dialog__link-row">
          <input id={viewId} readOnly value={viewLink} onFocus={(event) => event.target.select()} />
          <button type="button" onClick={() => copyLink(viewLink, 'view')}>
            {copied === 'view' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <button type="button" className="dialog__close" onClick={onClose}>
        Done
      </button>
    </Dialog>
  )
}

export default ShareDialog
