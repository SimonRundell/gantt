import { useCallback, useEffect, useRef, useState } from 'react'
import { saveProject } from '../services/projects.js'

const AUTOSAVE_DELAY_MS = 1500

/**
 * Builds the slice of a project document that gets saved and
 * autosaved on: title, calendar, view and the planning content.
 * Excludes server bookkeeping (id, revision, timestamps).
 * @param {object} project - the current project document
 * @returns {object} the saveable content
 */
function saveableContent(project) {
  return {
    title: project.title,
    calendar: project.calendar,
    view: project.view,
    tasks: project.tasks,
    dependencies: project.dependencies,
  }
}

/**
 * Drives autosave for the editor: a debounced save a short while
 * after the content last changed, a save status to show in the
 * toolbar, and 409 conflict detection when someone else saved a
 * newer version first.
 * @param {object} options
 * @param {string} options.projectId - the project id being edited
 * @param {string|null} options.editToken - the project's edit token, or null when read-only
 * @param {boolean} options.canEdit - whether this chart was opened with a valid edit token
 * @param {object} options.project - the current project document
 * @param {(action: {type: string, [key: string]: unknown}) => void} options.rawDispatch - the reducer's dispatch, bypassing the read-only guard (autosave is not a user edit)
 * @returns {{saveStatus: string, setSaveStatus: Function, conflict: object|null, setConflict: Function, save: () => Promise<void>, markSaved: (content: object) => void}} autosave state and controls
 */
export function useAutosave({ projectId, editToken, canEdit, project, rawDispatch }) {
  const [saveStatus, setSaveStatus] = useState(canEdit ? 'Saved' : 'View only')
  const [conflict, setConflict] = useState(null)

  // Tracks the content of the version already saved (or just loaded),
  // as a JSON string for a cheap equality check. Starting it at null
  // and filling it in on the first effect run - rather than a simple
  // "is this the first render" boolean - means React StrictMode's
  // deliberate double-invocation of effects in development can't
  // trick this into firing a spurious extra save: the second
  // invocation just finds the content unchanged.
  const lastSavedContentRef = useRef(null)

  /**
   * Records a version as already matching the server, so the next
   * autosave check compares against it rather than re-saving content
   * that was just imported or resolved from a conflict.
   * @param {object} content - the content now known to match the server
   * @returns {void}
   */
  const markSaved = useCallback((content) => {
    lastSavedContentRef.current = JSON.stringify(content)
  }, [])

  const save = useCallback(async () => {
    if (!canEdit || !editToken || projectId == null) return
    const content = saveableContent(project)
    setSaveStatus('Saving…')
    try {
      const result = await saveProject(projectId, editToken, { revision: project.revision, ...content })
      rawDispatch({ type: 'SET_SERVER_META', fields: { revision: result.revision, updatedAt: result.updatedAt } })
      markSaved(content)
      setSaveStatus('Saved')
    } catch (err) {
      if (err.response?.status === 409) {
        setConflict(err.response.data.project)
        setSaveStatus('Unsaved changes')
      } else {
        setSaveStatus('Could not save - will try again')
      }
    }
  }, [canEdit, editToken, projectId, project, rawDispatch, markSaved])

  useEffect(() => {
    const current = JSON.stringify(saveableContent(project))

    if (lastSavedContentRef.current === null) {
      lastSavedContentRef.current = current
      return undefined
    }
    if (current === lastSavedContentRef.current || !canEdit || conflict) return undefined

    setSaveStatus('Unsaved changes')
    const timer = setTimeout(save, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
    // Only the undoable content and the calendar/title/view are worth
    // autosaving on; re-running this effect on every render would
    // debounce against itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.title, project.calendar, project.view, project.tasks, project.dependencies])

  return { saveStatus, setSaveStatus, conflict, setConflict, save, markSaved }
}
