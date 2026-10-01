import { useMemo, useReducer } from 'react'
import { createInitialState, projectReducer } from './projectReducer.js'
import { ProjectContext } from './projectContextObject.js'

/**
 * Provides the project editor's state and dispatch function to every
 * component below it in the tree.
 * @param {{project: object, children: import('react').ReactNode}} props - the initial project document and children
 * @returns {JSX.Element} the context provider
 */
export function ProjectProvider({ project, children }) {
  const [state, dispatch] = useReducer(projectReducer, project, createInitialState)
  const value = useMemo(() => ({ state, dispatch }), [state])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}
