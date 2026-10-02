import { useId, useState } from 'react'
import { UK_BANK_HOLIDAYS } from '../lib/calendar.js'
import { expandDateRange, groupIntoRanges, mergeDates, removeDateRange } from '../lib/calendarEdit.js'
import { formatUKDate } from '../lib/dates.js'
import Dialog from './Dialog.jsx'

/** @type {{value: number, label: string}[]} the days of the week in display order, with their 0 (Sun) to 6 (Sat) values */
const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

/**
 * Describes a run of non-working days in plain words.
 * @param {import('../lib/calendarEdit.js').DateRange} range - the run to describe
 * @returns {string} for example "26/10/2026 to 30/10/2026 (5 days)" or "25/12/2026"
 */
function describeRange(range) {
  if (range.days === 1) return formatUKDate(range.from)
  return `${formatUKDate(range.from)} to ${formatUKDate(range.to)} (${range.days} days)`
}

/**
 * Dialog for setting a chart's working calendar: which days of the
 * week are working days, which day the week starts on, and a list of
 * holidays and closures that tasks skip over. Edits are held in a
 * draft and only applied (as one undo step) when Save is chosen.
 * @param {object} props
 * @param {import('../lib/calendar.js').WorkingCalendar} props.calendar - the chart's current calendar
 * @param {(calendar: import('../lib/calendar.js').WorkingCalendar) => void} props.onSave - called with the new calendar when Save is chosen
 * @param {() => void} props.onClose - called when the dialog is cancelled or closed
 * @returns {JSX.Element} the calendar dialog
 */
function CalendarDialog({ calendar, onSave, onClose }) {
  const [workingDays, setWorkingDays] = useState(calendar.workingDays)
  const [weekStartsOn, setWeekStartsOn] = useState(calendar.weekStartsOn)
  const [dates, setDates] = useState(calendar.nonWorkingDates)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [addError, setAddError] = useState('')
  const fromId = useId()
  const toId = useId()

  const ranges = groupIntoRanges(dates)
  const noWorkingDays = workingDays.length === 0

  /**
   * Ticks or unticks one day of the week as a working day.
   * @param {number} day - the day value, 0 (Sun) to 6 (Sat)
   * @returns {void}
   */
  function toggleWorkingDay(day) {
    setWorkingDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b),
    )
  }

  /**
   * Adds the date or date range typed into the form to the holiday list.
   * Leaving "to" empty adds just the one day.
   * @param {import('react').FormEvent} event - the form submit event
   * @returns {void}
   */
  function handleAdd(event) {
    event.preventDefault()
    if (!from) {
      setAddError('Choose a start date first.')
      return
    }
    const added = expandDateRange(from, to || from)
    if (added.length === 0) {
      setAddError(
        'That date range is not valid. The end date cannot be before the start, and it can cover at most a year.',
      )
      return
    }
    setDates((current) => mergeDates(current, added))
    setFrom('')
    setTo('')
    setAddError('')
  }

  /**
   * Adds one year's England bank holidays to the list.
   * @param {string} year - the year to add
   * @returns {void}
   */
  function addBankHolidays(year) {
    setDates((current) => mergeDates(current, UK_BANK_HOLIDAYS[year]))
  }

  return (
    <Dialog open onClose={onClose} label="Working calendar" className="calendar-dialog">
      <h2>Working calendar</h2>
      <p className="calendar-dialog__intro">
        Tasks skip non-working days, so a plan that runs over half term or Christmas stretches to fit.
      </p>

      <fieldset className="dialog__field">
        <legend>Working days</legend>
        <div className="calendar-dialog__days">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="calendar-dialog__day">
              <input
                type="checkbox"
                checked={workingDays.includes(day.value)}
                onChange={() => toggleWorkingDay(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
        {noWorkingDays && (
          <p className="calendar-dialog__error" role="alert">
            Choose at least one working day.
          </p>
        )}
      </fieldset>

      <label className="dialog__field">
        Week starts on
        <select value={weekStartsOn} onChange={(event) => setWeekStartsOn(Number(event.target.value))}>
          <option value={1}>Monday</option>
          <option value={0}>Sunday</option>
        </select>
      </label>

      <fieldset className="dialog__field">
        <legend>Holidays and closures</legend>

        <form className="calendar-dialog__add" onSubmit={handleAdd}>
          <label htmlFor={fromId}>
            From
            <input id={fromId} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label htmlFor={toId}>
            To (optional)
            <input
              id={toId}
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <button type="submit" className="btn">
            Add
          </button>
        </form>
        {addError && (
          <p className="calendar-dialog__error" role="alert">
            {addError}
          </p>
        )}

        <div className="calendar-dialog__presets">
          {Object.keys(UK_BANK_HOLIDAYS).map((year) => (
            <button key={year} type="button" className="btn" onClick={() => addBankHolidays(year)}>
              Add {year} bank holidays
            </button>
          ))}
        </div>

        {ranges.length === 0 ? (
          <p className="calendar-dialog__empty">No holidays added yet.</p>
        ) : (
          <ul className="calendar-dialog__list">
            {ranges.map((range) => (
              <li key={range.from}>
                <span>{describeRange(range)}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--danger"
                  aria-label={`Remove ${describeRange(range)}`}
                  onClick={() => setDates((current) => removeDateRange(current, range.from, range.to))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {ranges.length > 0 && (
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => setDates([])}>
            Remove all
          </button>
        )}
      </fieldset>

      <div className="dialog__actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="dialog__primary"
          disabled={noWorkingDays}
          onClick={() => onSave({ workingDays, nonWorkingDates: dates, weekStartsOn })}
        >
          Save calendar
        </button>
      </div>
    </Dialog>
  )
}

export default CalendarDialog
