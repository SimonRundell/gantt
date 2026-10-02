import { useEffect, useRef } from 'react'

/**
 * A thin wrapper around the native `<dialog>` element, used by every
 * dialog in the app. Native `showModal()` gives focus trapping and
 * Escape-to-close for free, rather than every dialog reimplementing
 * both (and some of them forgetting to).
 * @param {object} props
 * @param {boolean} props.open - whether the dialog should be showing
 * @param {() => void} props.onClose - called when the dialog is dismissed, by Escape, backdrop click, or a close button
 * @param {string} [props.label] - an accessible label for the dialog, when there is no visible heading element id to use
 * @param {string} [props.className] - extra class names for the dialog element
 * @param {import('react').ReactNode} props.children - the dialog's content
 * @returns {JSX.Element} the dialog element
 */
function Dialog({ open, onClose, label, className, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    /**
     * Keeps Escape under React's control instead of letting the
     * browser close the dialog without telling the app.
     * @param {Event} event - the native cancel event
     * @returns {void}
     */
    function handleCancel(event) {
      event.preventDefault()
      onClose()
    }

    /**
     * Closes the dialog on a click outside its content. A click on
     * the dialog element itself (rather than something inside it)
     * means the backdrop was clicked, since the dialog box only fills
     * its content's own size.
     * @param {MouseEvent} event - the click event
     * @returns {void}
     */
    function handleClick(event) {
      if (event.target === dialog) onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    dialog.addEventListener('click', handleClick)
    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      dialog.removeEventListener('click', handleClick)
    }
  }, [onClose])

  return (
    <dialog ref={ref} className={`dialog${className ? ` ${className}` : ''}`} aria-label={label}>
      {children}
    </dialog>
  )
}

export default Dialog
