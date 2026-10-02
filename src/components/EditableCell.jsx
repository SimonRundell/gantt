import { useRef, useState } from 'react'

/**
 * A table cell that shows its value as a button and turns into a small
 * input when clicked (or activated from the keyboard). Enter or leaving
 * the box commits; Escape cancels.
 * @param {object} props
 * @param {import('react').ReactNode} props.display - what to show while not editing
 * @param {string} props.value - the text to put in the input when editing starts
 * @param {string} props.label - what is being edited, for the accessible name (for example "Percent complete for Task A")
 * @param {string} [props.valueText] - a plain-text version of the value for the accessible name; defaults to `value`
 * @param {'text'|'date'|'number'} [props.inputType] - the kind of input to use
 * @param {number} [props.min] - lowest allowed number, for number inputs
 * @param {number} [props.max] - highest allowed number, for number inputs
 * @param {boolean} [props.disabled] - when true the value is shown but cannot be edited
 * @param {(text: string) => void} props.onCommit - called with the typed text when editing finishes
 * @returns {JSX.Element} the cell content
 */
function EditableCell({ display, value, label, valueText, inputType = 'text', min, max, disabled, onCommit }) {
  const [editing, setEditing] = useState(false)
  const cancelledRef = useRef(false)

  if (editing) {
    return (
      <input
        className="task-row__edit-input"
        type={inputType}
        min={min}
        max={max}
        autoFocus
        defaultValue={value}
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        onFocus={(event) => event.target.select?.()}
        onBlur={(event) => {
          if (!cancelledRef.current) onCommit(event.target.value)
          cancelledRef.current = false
          setEditing(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            cancelledRef.current = true
            event.currentTarget.blur()
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      className="task-row__cell-button"
      disabled={disabled}
      aria-label={`${label}: ${valueText ?? (value || 'none')}, click to edit`}
      onClick={(event) => {
        event.stopPropagation()
        setEditing(true)
      }}
    >
      {display}
    </button>
  )
}

export default EditableCell
