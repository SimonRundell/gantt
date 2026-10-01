import { useState } from 'react'
import { ZOOM_LEVELS } from '../lib/timelineScale.js'

/**
 * The editor's top toolbar: the project title, undo/redo, task
 * structure actions, the zoom selector, and a "go to today" button.
 * Export, sharing and the shortcuts dialog are added in later build
 * phases.
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
 * @param {(taskType: 'task'|'milestone'|'group') => void} props.onAddTask - called when a new task should be added
 * @param {boolean} props.hasSelection - whether a task is currently selected, enabling the structure buttons
 * @param {() => void} props.onDeleteTask - called when the selected task should be deleted
 * @param {() => void} props.onIndent - called when the selected task should be indented
 * @param {() => void} props.onOutdent - called when the selected task should be outdented
 * @param {() => void} props.onMoveUp - called when the selected task should move up among its siblings
 * @param {() => void} props.onMoveDown - called when the selected task should move down among its siblings
 * @param {boolean} props.showCriticalPath - whether the critical path highlight is on
 * @param {() => void} props.onToggleCriticalPath - called when the critical path toggle is used
 * @param {string} props.saveStatus - a short save status label to display
 * @param {boolean} props.readOnly - whether this chart was opened without an edit link
 * @param {() => void} props.onDownload - called when the download button is used
 * @param {() => void} props.onUploadClick - called when the upload button is used
 * @param {() => void} props.onShare - called when the share button is used
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
  hasSelection,
  onDeleteTask,
  onIndent,
  onOutdent,
  onMoveUp,
  onMoveDown,
  showCriticalPath,
  onToggleCriticalPath,
  saveStatus,
  readOnly,
  onDownload,
  onUploadClick,
  onShare,
}) {
  const [draftTitle, setDraftTitle] = useState(title)

  return (
    <div className="toolbar">
      <input
        className="toolbar__title"
        value={draftTitle}
        aria-label="Project title"
        readOnly={readOnly}
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={() => {
          if (readOnly) return
          if (draftTitle.trim() !== '' && draftTitle !== title) onTitleChange(draftTitle.trim())
          else setDraftTitle(title)
        }}
      />

      <span className="toolbar__save-status" role="status">
        {readOnly ? 'View only' : saveStatus}
      </span>

      <div className="toolbar__group" role="group" aria-label="Edit history">
        <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
          Redo
        </button>
      </div>

      <div className="toolbar__group" role="group" aria-label="Add">
        <button type="button" onClick={() => onAddTask('task')} disabled={readOnly}>
          Add task
        </button>
        <button type="button" onClick={() => onAddTask('milestone')} disabled={readOnly}>
          Add milestone
        </button>
        <button type="button" onClick={() => onAddTask('group')} disabled={readOnly}>
          Add group
        </button>
      </div>

      <div className="toolbar__group" role="group" aria-label="Task structure">
        <button type="button" onClick={onOutdent} disabled={!hasSelection} aria-label="Outdent task">
          ⇤ Outdent
        </button>
        <button type="button" onClick={onIndent} disabled={!hasSelection} aria-label="Indent task">
          ⇥ Indent
        </button>
        <button type="button" onClick={onMoveUp} disabled={!hasSelection} aria-label="Move task up">
          ↑ Up
        </button>
        <button type="button" onClick={onMoveDown} disabled={!hasSelection} aria-label="Move task down">
          ↓ Down
        </button>
        <button type="button" onClick={onDeleteTask} disabled={!hasSelection} aria-label="Delete task">
          Delete
        </button>
      </div>

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

      <div className="toolbar__group" role="group" aria-label="Save and share">
        <button type="button" onClick={onDownload}>
          Download
        </button>
        <button type="button" onClick={onUploadClick} disabled={readOnly}>
          Upload
        </button>
        <button type="button" onClick={onShare}>
          Share
        </button>
      </div>
    </div>
  )
}

export default Toolbar
