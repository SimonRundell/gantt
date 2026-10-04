import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ZOOM_LEVELS } from '../lib/timelineScale.js'
import Icon from './Icon.jsx'

/**
 * The editor's top toolbar: the project title, undo/redo, task
 * structure actions, the zoom selector, and a "go to today" button.
 * Export, sharing and the shortcuts dialog are added in later build
 * phases.
 * @param {object} props
 * @param {string} props.title - the project's current title
 * @param {(title: string) => void} props.onTitleChange - called when the title is edited and committed
 * @param {string} props.zoom - the current zoom level, or 'custom' after zooming with the mouse wheel
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
 * @param {() => void} props.onExport - called when the export (PNG/PDF) button is used
 * @param {() => void} props.onPrint - called when the print button is used
 * @param {boolean} props.detailsOpen - whether the task details panel is showing
 * @param {() => void} props.onToggleDetails - called when the Details button is used
 * @param {string} props.snap - the current drag snapping, 'day' or 'week'
 * @param {(snap: string) => void} props.onSnapChange - called when a new snapping option is chosen
 * @param {() => void} props.onOpenColumns - called when the Columns button is used
 * @param {() => void} props.onOpenResources - called when the Resources button is used
 * @param {() => void} props.onOpenBaseline - called when the Baseline button is used
 * @param {() => void} props.onOpenFilter - called when the Filter button is used
 * @param {boolean} props.filterActive - whether a filter is currently narrowing the table and timeline
 * @param {() => void} props.onOpenCalendar - called when the working calendar button is used
 * @param {() => void} props.onShowShortcuts - called when the keyboard shortcuts button is used
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
  onExport,
  onPrint,
  detailsOpen,
  onToggleDetails,
  snap,
  onSnapChange,
  onOpenColumns,
  onOpenResources,
  onOpenBaseline,
  onOpenFilter,
  filterActive,
  onOpenCalendar,
  onShowShortcuts,
}) {
  const [draftTitle, setDraftTitle] = useState(title)

  return (
    <header className="toolbar">
      <div className="toolbar__top">
        <Link className="toolbar__home" to="/" aria-label="Gantt Chart Planner home">
          <Icon name="calendar" />
        </Link>
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

        <span
          className={`toolbar__save-status${readOnly ? ' toolbar__save-status--readonly' : ''}`}
          role="status"
        >
          {readOnly ? 'View only' : saveStatus}
        </span>

        <div className="toolbar__group toolbar__group--end" role="group" aria-label="Save and share">
          <button type="button" className="btn btn--on-dark" onClick={onDownload}>
            <Icon name="download" />
            Download
          </button>
          <button type="button" className="btn btn--on-dark" onClick={onUploadClick} disabled={readOnly}>
            <Icon name="upload" />
            Upload
          </button>
          <button type="button" className="btn btn--on-dark" onClick={onExport}>
            <Icon name="image" />
            Export
          </button>
          <button type="button" className="btn btn--on-dark" onClick={onPrint}>
            <Icon name="print" />
            Print
          </button>
          <button type="button" className="btn btn--accent" onClick={onShare}>
            <Icon name="share" />
            Share
          </button>
          <button
            type="button"
            className="btn btn--on-dark btn--icon"
            onClick={onShowShortcuts}
            aria-label="Keyboard shortcuts"
          >
            <Icon name="help" />
          </button>
        </div>
      </div>

      <div className="toolbar__tools">
        <div className="toolbar__group" role="group" aria-label="Edit history">
          <button type="button" className="btn btn--ghost" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
            <Icon name="undo" />
            Undo
          </button>
          <button type="button" className="btn btn--ghost" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
            <Icon name="redo" />
            Redo
          </button>
        </div>

        <div className="toolbar__group" role="group" aria-label="Add">
          <button type="button" className="btn btn--primary" onClick={() => onAddTask('task')} disabled={readOnly}>
            <Icon name="plus" />
            Add task
          </button>
          <button type="button" className="btn" onClick={() => onAddTask('milestone')} disabled={readOnly}>
            <Icon name="milestone" />
            Add milestone
          </button>
          <button type="button" className="btn" onClick={() => onAddTask('group')} disabled={readOnly}>
            <Icon name="group" />
            Add group
          </button>
        </div>

        <div className="toolbar__group" role="group" aria-label="Task structure">
          <button type="button" className="btn btn--ghost" onClick={onOutdent} disabled={!hasSelection} aria-label="Outdent task">
            <Icon name="outdent" />
            Outdent
          </button>
          <button type="button" className="btn btn--ghost" onClick={onIndent} disabled={!hasSelection} aria-label="Indent task">
            <Icon name="indent" />
            Indent
          </button>
          <button type="button" className="btn btn--ghost" onClick={onMoveUp} disabled={!hasSelection} aria-label="Move task up">
            <Icon name="up" />
            Up
          </button>
          <button type="button" className="btn btn--ghost" onClick={onMoveDown} disabled={!hasSelection} aria-label="Move task down">
            <Icon name="down" />
            Down
          </button>
          <button type="button" className="btn btn--danger" onClick={onDeleteTask} disabled={!hasSelection} aria-label="Delete task">
            <Icon name="trash" />
            Delete
          </button>
          <button
            type="button"
            className={`btn btn--ghost${detailsOpen ? ' btn--active' : ''}`}
            onClick={onToggleDetails}
            aria-pressed={detailsOpen}
          >
            <Icon name="panel" />
            Details
          </button>
        </div>

        <div className="toolbar__group" role="group" aria-label="Plan settings">
          <button type="button" className="btn btn--ghost" onClick={onOpenCalendar} disabled={readOnly}>
            <Icon name="calendar" />
            Calendar
          </button>
          <button type="button" className="btn btn--ghost" onClick={onOpenColumns}>
            <Icon name="columns" />
            Columns
          </button>
          <button type="button" className="btn btn--ghost" onClick={onOpenResources}>
            <Icon name="users" />
            Resources
          </button>
          <button type="button" className="btn btn--ghost" onClick={onOpenBaseline}>
            <Icon name="flag" />
            Baseline
          </button>
          <button
            type="button"
            className={`btn btn--ghost${filterActive ? ' btn--active' : ''}`}
            onClick={onOpenFilter}
            aria-pressed={filterActive}
          >
            <Icon name="filter" />
            Filter
          </button>
        </div>

        <div className="toolbar__group toolbar__group--end">
          <label className="toolbar__zoom">
            Zoom
            <select value={zoom} onChange={(event) => onZoomChange(event.target.value)}>
              {zoom === 'custom' && <option value="custom">Custom</option>}
              {Object.entries(ZOOM_LEVELS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar__zoom">
            Snap
            <select value={snap} onChange={(event) => onSnapChange(event.target.value)}>
              <option value="day">Day</option>
              <option value="week">Week</option>
            </select>
          </label>

          <button type="button" className="btn" onClick={onGoToToday}>
            <Icon name="today" />
            Go to today
          </button>

          <label className="toolbar__checkbox">
            <input type="checkbox" checked={showCriticalPath} onChange={onToggleCriticalPath} />
            <Icon name="route" />
            Critical path
          </label>
        </div>
      </div>
    </header>
  )
}

export default Toolbar
