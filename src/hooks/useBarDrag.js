import { useRef } from 'react'
import { snapForwardToWorkingDay, workingDaysBetween } from '../lib/calendar.js'
import { addCalendarDays } from '../lib/dates.js'
import { computeEnd } from '../lib/scheduler.js'
import { pxPerDayFor } from '../lib/timelineScale.js'

/**
 * Drives bar-drag gestures on the timeline: moving a bar, resizing
 * either edge, or dragging the percent-complete handle. Wraps each
 * whole gesture in BEGIN_DRAG/END_DRAG so it becomes a single undo
 * step, and keeps the in-progress drag's starting point in a ref
 * rather than React state, since the drag math runs on every
 * pointermove and has no need to trigger its own re-renders.
 * @param {object} options
 * @param {object} options.project - the current project document (its calendar and zoom are read during a drag)
 * @param {Map<string, import('../lib/scheduler.js').Task>} options.tasksById - every task keyed by id
 * @param {(action: {type: string, [key: string]: unknown}) => void} options.dispatch - the project reducer's dispatch function
 * @param {boolean} options.canEdit - whether dragging is currently allowed
 * @returns {(taskId: string, event: import('react').PointerEvent, handle: 'move'|'resize-start'|'resize-end'|'percent', barWidth: number) => void} the pointer-down handler to attach to a bar
 */
export function useBarDrag({ project, tasksById, dispatch, canEdit }) {
  const dragStateRef = useRef(null)

  /**
   * Continues an in-progress bar drag, translating the pointer's
   * movement into a date, duration or percent change and previewing
   * it live without pushing an undo step yet.
   * @param {PointerEvent} event - the pointer move event
   * @returns {void}
   */
  function handleDragMove(event) {
    const drag = dragStateRef.current
    if (!drag) return
    const deltaPx = event.clientX - drag.startX

    if (drag.handle === 'percent') {
      const deltaPercent = drag.barWidth > 0 ? (deltaPx / drag.barWidth) * 100 : 0
      const percent = Math.max(0, Math.min(100, Math.round(drag.originalPercent + deltaPercent)))
      dispatch({ type: 'DRAG_PREVIEW', taskId: drag.taskId, fields: { percent } })
      return
    }

    const deltaDays = Math.round(deltaPx / drag.pxPerDay)

    if (drag.handle === 'move') {
      const start = snapForwardToWorkingDay(addCalendarDays(drag.originalStart, deltaDays), project.calendar)
      dispatch({ type: 'DRAG_PREVIEW', taskId: drag.taskId, fields: { start } })
    } else if (drag.handle === 'resize-end') {
      const rawEnd = addCalendarDays(drag.originalEnd, deltaDays)
      const end = snapForwardToWorkingDay(rawEnd, project.calendar)
      const durationDays = Math.max(1, workingDaysBetween(drag.originalStart, end, project.calendar) + 1)
      dispatch({ type: 'DRAG_PREVIEW', taskId: drag.taskId, fields: { durationDays } })
    } else if (drag.handle === 'resize-start') {
      const rawStart = addCalendarDays(drag.originalStart, deltaDays)
      const start = snapForwardToWorkingDay(rawStart, project.calendar)
      if (start > drag.originalEnd) return
      const durationDays = Math.max(1, workingDaysBetween(start, drag.originalEnd, project.calendar) + 1)
      dispatch({ type: 'DRAG_PREVIEW', taskId: drag.taskId, fields: { start, durationDays } })
    }
  }

  /**
   * Ends an in-progress bar drag and commits it as one undo step.
   * @returns {void}
   */
  function handleDragUp() {
    window.removeEventListener('pointermove', handleDragMove)
    window.removeEventListener('pointerup', handleDragUp)
    dragStateRef.current = null
    dispatch({ type: 'END_DRAG' })
  }

  /**
   * Starts a bar drag: moving the whole bar, resizing one edge, or
   * dragging the percent-complete handle.
   * @param {string} taskId - the task being dragged
   * @param {import('react').PointerEvent} event - the pointer down event
   * @param {'move'|'resize-start'|'resize-end'|'percent'} handle - which part of the bar was grabbed
   * @param {number} barWidth - the bar's current width in pixels, used for percent dragging
   * @returns {void}
   */
  function handleBarPointerDown(taskId, event, handle, barWidth) {
    if (!canEdit) return
    const task = tasksById.get(taskId)
    if (!task) return

    dragStateRef.current = {
      taskId,
      handle,
      startX: event.clientX,
      originalStart: task.start,
      originalEnd: computeEnd(task, project.calendar),
      originalPercent: task.percent,
      barWidth,
      pxPerDay: pxPerDayFor(project.view.zoom),
    }
    dispatch({ type: 'SELECT_TASK', taskId })
    dispatch({ type: 'BEGIN_DRAG' })

    window.addEventListener('pointermove', handleDragMove)
    window.addEventListener('pointerup', handleDragUp)
  }

  return handleBarPointerDown
}
