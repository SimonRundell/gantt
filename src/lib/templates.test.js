import { describe, expect, it } from 'vitest'
import { detectCycle } from './scheduler.js'
import { TEMPLATES } from './templates.js'

describe('TEMPLATES', () => {
  it('offers three templates', () => {
    expect(TEMPLATES).toHaveLength(3)
  })

  for (const template of TEMPLATES) {
    describe(template.name, () => {
      it('builds a project with unique task ids and valid dependency references', () => {
        const project = template.build()
        const ids = new Set(project.tasks.map((t) => t.id))
        expect(ids.size).toBe(project.tasks.length)

        for (const dep of project.dependencies) {
          expect(ids.has(dep.from)).toBe(true)
          expect(ids.has(dep.to)).toBe(true)
        }
      })

      it('has no circular dependencies', () => {
        const project = template.build()
        expect(detectCycle(project.dependencies)).toBeNull()
      })

      it('gives every parentId a task that exists', () => {
        const project = template.build()
        const ids = new Set(project.tasks.map((t) => t.id))
        for (const t of project.tasks) {
          if (t.parentId !== null) expect(ids.has(t.parentId)).toBe(true)
        }
      })
    })
  }
})
