import { describe, expect, it } from 'vitest'
import { dropPositionFromOffset } from './dragReorder.js'

describe('dropPositionFromOffset', () => {
  it('uses the top and bottom quarters for before and after', () => {
    expect(dropPositionFromOffset(2, 32, false)).toBe('before')
    expect(dropPositionFromOffset(30, 32, false)).toBe('after')
    expect(dropPositionFromOffset(2, 32, true)).toBe('before')
    expect(dropPositionFromOffset(30, 32, true)).toBe('after')
  })

  it('means inside for the middle of a group', () => {
    expect(dropPositionFromOffset(16, 32, true)).toBe('inside')
  })

  it('picks the nearer edge for the middle of an ordinary task', () => {
    expect(dropPositionFromOffset(11, 32, false)).toBe('before')
    expect(dropPositionFromOffset(20, 32, false)).toBe('after')
  })
})
