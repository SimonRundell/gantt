import { describe, expect, it } from 'vitest'
import { slugify } from './downloadFile.js'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Employer Set Project')).toBe('employer-set-project')
  })

  it('strips punctuation', () => {
    expect(slugify("Sam's Project: v2!")).toBe('sam-s-project-v2')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -- Untitled -- ')).toBe('untitled')
  })

  it('falls back to "project" for an empty or unusable title', () => {
    expect(slugify('')).toBe('project')
    expect(slugify('***')).toBe('project')
  })
})
