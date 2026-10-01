import { beforeEach, describe, expect, it } from 'vitest'
import { forgetRecentProject, loadRecentProjects, recordRecentProject } from './recentProjects.js'

beforeEach(() => {
  localStorage.clear()
})

describe('recordRecentProject and loadRecentProjects', () => {
  it('starts empty', () => {
    expect(loadRecentProjects()).toEqual([])
  })

  it('records a project and reads it back, newest first', () => {
    recordRecentProject({ id: 'a', title: 'First', editToken: 'tok-a' })
    recordRecentProject({ id: 'b', title: 'Second', editToken: 'tok-b' })

    const recents = loadRecentProjects()
    expect(recents.map((p) => p.id)).toEqual(['b', 'a'])
    expect(recents[0].title).toBe('Second')
    expect(recents[0].editToken).toBe('tok-b')
  })

  it('moves a re-opened project back to the front instead of duplicating it', () => {
    recordRecentProject({ id: 'a', title: 'First' })
    recordRecentProject({ id: 'b', title: 'Second' })
    recordRecentProject({ id: 'a', title: 'First again' })

    const recents = loadRecentProjects()
    expect(recents).toHaveLength(2)
    expect(recents[0].id).toBe('a')
    expect(recents[0].title).toBe('First again')
  })

  it('trims to the maximum length', () => {
    for (let i = 0; i < 20; i++) {
      recordRecentProject({ id: `p${i}`, title: `Project ${i}` })
    }
    expect(loadRecentProjects().length).toBeLessThanOrEqual(12)
  })
})

describe('forgetRecentProject', () => {
  it('removes a project from the list', () => {
    recordRecentProject({ id: 'a', title: 'First' })
    recordRecentProject({ id: 'b', title: 'Second' })
    forgetRecentProject('a')

    const recents = loadRecentProjects()
    expect(recents.map((p) => p.id)).toEqual(['b'])
  })
})
