import { useState } from 'react'
import Dialog from './Dialog.jsx'

/**
 * Lets a student choose PNG or PDF export, and for PDF the page size,
 * orientation and whether to fit the chart to one page wide or tile
 * it across a grid of pages at something closer to actual size.
 * @param {object} props
 * @param {(options: {format: 'png'|'pdf', pageSize: 'a4'|'a3', orientation: 'portrait'|'landscape', fit: 'width'|'tile'}) => Promise<void>} props.onExport - called with the chosen options
 * @param {() => void} props.onClose - called when the dialog should close
 * @returns {JSX.Element} the export dialog
 */
function ExportDialog({ onExport, onClose }) {
  const [format, setFormat] = useState('png')
  const [pageSize, setPageSize] = useState('a4')
  const [orientation, setOrientation] = useState('landscape')
  const [fit, setFit] = useState('width')
  const [busy, setBusy] = useState(false)

  /**
   * Runs the export with the currently chosen options.
   * @returns {Promise<void>} resolves once the export finishes
   */
  async function handleExport() {
    setBusy(true)
    try {
      await onExport({ format, pageSize, orientation, fit })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={() => !busy && onClose()} label="Export chart">
      <h2>Export chart</h2>

      <fieldset className="dialog__field">
        <legend>Format</legend>
        <label>
          <input type="radio" name="format" checked={format === 'png'} onChange={() => setFormat('png')} /> PNG image
        </label>
        <label>
          <input type="radio" name="format" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /> PDF
        </label>
      </fieldset>

      {format === 'pdf' && (
        <>
          <fieldset className="dialog__field">
            <legend>Page size</legend>
            <label>
              <input type="radio" name="pageSize" checked={pageSize === 'a4'} onChange={() => setPageSize('a4')} />{' '}
              A4
            </label>
            <label>
              <input type="radio" name="pageSize" checked={pageSize === 'a3'} onChange={() => setPageSize('a3')} />{' '}
              A3
            </label>
          </fieldset>

          <fieldset className="dialog__field">
            <legend>Orientation</legend>
            <label>
              <input
                type="radio"
                name="orientation"
                checked={orientation === 'landscape'}
                onChange={() => setOrientation('landscape')}
              />{' '}
              Landscape
            </label>
            <label>
              <input
                type="radio"
                name="orientation"
                checked={orientation === 'portrait'}
                onChange={() => setOrientation('portrait')}
              />{' '}
              Portrait
            </label>
          </fieldset>

          <fieldset className="dialog__field">
            <legend>Fit</legend>
            <label>
              <input type="radio" name="fit" checked={fit === 'width'} onChange={() => setFit('width')} /> Fit to one
              page wide
            </label>
            <label>
              <input type="radio" name="fit" checked={fit === 'tile'} onChange={() => setFit('tile')} /> Tile across
              pages
            </label>
          </fieldset>
        </>
      )}

      <div className="dialog__actions">
        <button type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="dialog__primary" onClick={handleExport} disabled={busy}>
          {busy ? 'Exporting…' : 'Export'}
        </button>
      </div>
    </Dialog>
  )
}

export default ExportDialog
