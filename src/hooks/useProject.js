import { useContext } from 'react'
import { ProjectContext } from '../state/projectContextObject.js'

/**
 * Reads the project editor's state and dispatch function. Must be
 * called from inside a ProjectProvider.
 * @returns {{state: object, dispatch: Function}} the current state and dispatch function
 */
export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used inside a ProjectProvider')
  }
  return context
}
