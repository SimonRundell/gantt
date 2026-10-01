import { useEffect } from 'react'

const AUTO_DISMISS_MS = 6000

/**
 * A small notice at the edge of the screen for messages that need a
 * moment of attention but shouldn't block anything - a rejected
 * circular dependency, for example. Dismisses itself after a few
 * seconds, or immediately if the user clicks it away.
 * @param {object} props
 * @param {string|null} props.message - the message to show, or null to show nothing
 * @param {() => void} props.onDismiss - called when the toast should close
 * @returns {JSX.Element|null} the toast, or nothing when there is no message
 */
function Toast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  if (!message) return null

  return (
    <div className="toast" role="alert">
      <span>{message}</span>
      <button type="button" className="toast__dismiss" onClick={onDismiss} aria-label="Dismiss message">
        ×
      </button>
    </div>
  )
}

export default Toast
