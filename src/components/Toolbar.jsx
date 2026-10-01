import { useState } from 'react'
import { ZOOM_LEVELS } from '../lib/timelineScale.js'

/**
 * The editor's top toolbar: the project title, undo/redo, the zoom
 * selector, and a "go to today" button. Export, sharing and the
 * shortcuts dialog are added in later build phases.
 * @param {object} props
 * @param {string} props.title - the project's current title
 * @param {(title: string) => void} props.onTitleChange - called when the title is edited and committed
 * @param {string} props.zoom - the current zoom level
 * @param {(zoom: string) => void} props.onZoomChange - called when a new zoom level is chosen
 * @param {boolean} props.canUndo - whether there is anything to undo
 * @param {boolean} props.canRedo - whether there is anything to redo
 * @param {() => void} props.onUndo - called when undo is requested
 * @param {() => void} props.onRedo - called when redo is requested
 * @param {() => void} props.onGoToToday - called when "today" is requested
 * @param {() => void} props.onAddTask - called when a new task should be added
 * @param {boolean} props.showCriticalPath - whether the critical path highlight is on
 * @param {() => void} props.onToggleCriticalPath - called when the critical path toggle is used
 * @param {string} props.saveStatus - a short save status label to display
 * @returns {JSX.Element} the toolbar
 */
function Toolbar({
  title,
  onTitleChange,
  zoom,
  onZoomChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onGoToToday,
  onAddTask,
  showCriticalPath,
  onToggleCriticalPath,
  saveStatus,
}) {
  const [draftTitle, setDraftTitle] = useState(title)

  return (
    <div className="toolbar">
      <input
        className="toolbar__title"
        value={draftTitle}
        aria-label="Project title"
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={() => {
          if (draftTitle.trim() !== '' && draftTitle !== title) onTitleChange(draftTitle.trim())
          else setDraftTitle(title)
        }}
      />

      <span className="toolbar__save-status" role="status">
        {saveStatus}
      </span>

      <div className="toolbar__group" role="group" aria-label="Edit history">
        <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
          Redo
        </button>
      </div>

      <button type="button" onClick={onAddTask}>
        Add task
      </button>

      <label className="toolbar__zoom">
        Zoom
        <select value={zoom} onChange={(event) => onZoomChange(event.target.value)}>
          {Object.entries(ZOOM_LEVELS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <button type="button" onClick={onGoToToday}>
        Go to today
      </button>

      <label className="toolbar__checkbox">
        <input type="checkbox" checked={showCriticalPath} onChange={onToggleCriticalPath} />
        Critical path
      </label>
    </div>
  )
}

export default Toolbar
