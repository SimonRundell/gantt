import { useState } from 'react'
import { baselineEnd, baselineVarianceDays, formatVariance } from '../lib/baseline.js'
import { TASK_COLOURS } from '../lib/constants.js'
import { formatUKDate } from '../lib/dates.js'
import { computeEnd } from '../lib/scheduler.js'
import { parseTaskField } from '../lib/taskFields.js'
import Icon from './Icon.jsx'

/** @type {{value: string, label: string}[]} the kinds of task a row can be */
const TASK_TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'group', label: 'Group' },
]

/**
 * A side panel for editing every detail of the selected task: name,
 * type, dates, duration, percent complete, assignee, colour and notes.
 * Text fields apply when you leave them (or press Enter), so typing
 * does not create an undo step per keystroke. Fields that are worked
 * out automatically (a group's dates, a milestone's duration) are
 * shown but locked.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Task|null} props.task - the selected task, or null when nothing is selected
 * @param {boolean} props.hasChildren - whether the selected task has child tasks
 * @param {import('../lib/calendar.js').WorkingCalendar} props.calendar - the project's working calendar
 * @param {boolean} props.readOnly - when true every field is locked
 * @param {(taskId: string, fields: object) => void} props.onFieldChange - called with changed fields such as `{ percent: 50 }`
 * @param {(taskId: string, taskType: string) => void} props.onTypeChange - called when the type is changed
 * @param {(taskId: string) => void} props.onDuplicate - called when Duplicate is chosen
 * @param {(taskId: string) => void} props.onDelete - called when Delete is chosen
 * @param {(taskId: string, author: string, text: string) => void} props.onAddComment - called when a comment is added
 * @param {() => void} props.onClose - called when the panel is closed
 * @returns {JSX.Element} the details panel
 */
function TaskPanel({
  task,
  hasChildren,
  calendar,
  readOnly,
  onFieldChange,
  onTypeChange,
  onDuplicate,
  onDelete,
  onAddComment,
  onClose,
}) {
  return (
    <aside className="task-panel" aria-label="Task details">
      <div className="task-panel__header">
        <h2>Task details</h2>
        <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close task details">
          &times;
        </button>
      </div>

      {!task ? (
        <p className="task-panel__empty">Select a task in the table or on the chart to edit its details here.</p>
      ) : (
        <PanelFields
          key={task.id}
          task={task}
          hasChildren={hasChildren}
          calendar={calendar}
          readOnly={readOnly}
          onFieldChange={onFieldChange}
          onTypeChange={onTypeChange}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onAddComment={onAddComment}
        />
      )}
    </aside>
  )
}

/**
 * The fields for one selected task. Split out so React gives each task
 * a fresh set of inputs when the selection changes.
 * @param {object} props - the same props as TaskPanel, minus the close handler, with `task` always set
 * @returns {JSX.Element} the fields
 */
function PanelFields({ task, hasChildren, calendar, readOnly, onFieldChange, onTypeChange, onDuplicate, onDelete, onAddComment }) {
  const isGroup = task.type === 'group'
  const isMilestone = task.type === 'milestone'
  const end = computeEnd(task, calendar)
  const variance = baselineVarianceDays(task, calendar)

  /**
   * Builds the handler for an input that applies its value on blur
   * or Enter, through the shared parser.
   * @param {'start'|'durationDays'|'percent'} field - the field the input edits
   * @returns {{onBlur: Function, onKeyDown: Function}} event handlers for the input
   */
  function numericHandlers(field) {
    return {
      onBlur: (event) => {
        const fields = parseTaskField(field, event.target.value)
        if (fields) onFieldChange(task.id, fields)
      },
      onKeyDown: (event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      },
    }
  }

  return (
    <div className="task-panel__body">
      <label className="task-panel__field">
        Name
        <input
          type="text"
          key={`name-${task.name}`}
          defaultValue={task.name}
          disabled={readOnly}
          onBlur={(event) => {
            const value = event.target.value.trim()
            if (value !== '' && value !== task.name) onFieldChange(task.id, { name: value })
            else event.target.value = task.name
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </label>

      <label className="task-panel__field">
        Type
        <select
          value={task.type}
          disabled={readOnly || (isGroup && hasChildren)}
          onChange={(event) => onTypeChange(task.id, event.target.value)}
        >
          {TASK_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isGroup && hasChildren && <small>A group with tasks inside cannot change type.</small>}
      </label>

      <div className="task-panel__row">
        <label className="task-panel__field">
          Start
          <input
            type="date"
            key={`start-${task.start}`}
            defaultValue={task.start}
            disabled={readOnly || isGroup}
            {...numericHandlers('start')}
          />
        </label>
        <label className="task-panel__field">
          Duration (working days)
          <input
            type="number"
            min={1}
            key={`dur-${task.durationDays}`}
            defaultValue={isMilestone ? 0 : task.durationDays}
            disabled={readOnly || isGroup || isMilestone}
            {...numericHandlers('durationDays')}
          />
        </label>
      </div>

      <p className="task-panel__info">
        Finishes <strong>{formatUKDate(end)}</strong>
        {isGroup && ' (worked out from the tasks inside)'}
      </p>

      <label className="task-panel__field">
        Percent complete
        <input
          type="number"
          min={0}
          max={100}
          key={`pct-${task.percent}`}
          defaultValue={task.percent}
          disabled={readOnly || isGroup}
          {...numericHandlers('percent')}
        />
      </label>

      <label className="task-panel__field">
        Assignee
        <input
          type="text"
          key={`who-${task.assignee}`}
          defaultValue={task.assignee}
          disabled={readOnly}
          placeholder="Who is doing this?"
          onBlur={(event) => {
            if (event.target.value !== task.assignee) onFieldChange(task.id, { assignee: event.target.value })
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </label>

      <fieldset className="task-panel__field task-panel__colours">
        <legend>Colour</legend>
        <div className="task-panel__swatches">
          {TASK_COLOURS.map((colour) => (
            <button
              key={colour.value}
              type="button"
              className={`task-panel__swatch task-panel__swatch--${colour.value}`}
              aria-label={colour.label}
              aria-pressed={task.colour === colour.value}
              disabled={readOnly}
              onClick={() => onFieldChange(task.id, { colour: colour.value })}
            />
          ))}
        </div>
      </fieldset>

      <label className="task-panel__field">
        Notes
        <textarea
          rows={4}
          key={`notes-${task.notes}`}
          defaultValue={task.notes}
          disabled={readOnly}
          onBlur={(event) => {
            if (event.target.value !== task.notes) onFieldChange(task.id, { notes: event.target.value })
          }}
        />
      </label>

      <CommentsSection task={task} readOnly={readOnly} onAddComment={onAddComment} />

      {task.baseline && (
        <p className="task-panel__info">
          Baseline: {formatUKDate(task.baseline.start)} to {formatUKDate(baselineEnd(task, calendar))}
          {variance !== null && (
            <>
              {' '}
              (<strong>{formatVariance(variance)}</strong> at the finish)
            </>
          )}
        </p>
      )}

      <div className="task-panel__actions">
        <button type="button" className="btn" disabled={readOnly} onClick={() => onDuplicate(task.id)}>
          <Icon name="copy" />
          Duplicate
        </button>
        <button type="button" className="btn btn--danger" disabled={readOnly} onClick={() => onDelete(task.id)}>
          <Icon name="trash" />
          Delete
        </button>
      </div>
    </div>
  )
}

/**
 * A task's comments: an append-only log (no edit or delete) of who
 * said what and when, separate from the single free-text Notes
 * field. Each comment is typed with the author's name alongside it,
 * since there are no accounts to know who is writing.
 * @param {object} props
 * @param {import('../lib/scheduler.js').Task} props.task - the task whose comments to show
 * @param {boolean} props.readOnly - when true the add-comment form is hidden
 * @param {(taskId: string, author: string, text: string) => void} props.onAddComment - called when a comment is submitted
 * @returns {JSX.Element} the comments section
 */
function CommentsSection({ task, readOnly, onAddComment }) {
  const [author, setAuthor] = useState('')
  const [text, setText] = useState('')
  const comments = task.comments ?? []
  const sorted = [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const canAdd = author.trim() !== '' && text.trim() !== ''

  /** Adds the comment and clears the text field, keeping the typed name for the next one. */
  function handleAdd() {
    if (!canAdd) return
    onAddComment(task.id, author, text)
    setText('')
  }

  return (
    <fieldset className="task-panel__field task-panel__comments">
      <legend>Comments</legend>

      {sorted.length === 0 ? (
        <p className="task-panel__empty">No comments yet.</p>
      ) : (
        <ul className="task-panel__comment-list">
          {sorted.map((comment) => (
            <li key={comment.id}>
              <div className="task-panel__comment-meta">
                <strong>{comment.author}</strong>
                <span>{new Date(comment.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <p>{comment.text}</p>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="task-panel__comment-form">
          <input
            type="text"
            placeholder="Your name"
            aria-label="Your name"
            value={author}
            maxLength={60}
            onChange={(event) => setAuthor(event.target.value)}
          />
          <textarea
            rows={2}
            placeholder="Add a comment"
            aria-label="Comment text"
            value={text}
            maxLength={1000}
            onChange={(event) => setText(event.target.value)}
          />
          <button type="button" className="btn" disabled={!canAdd} onClick={handleAdd}>
            Add comment
          </button>
        </div>
      )}
    </fieldset>
  )
}

export default TaskPanel
