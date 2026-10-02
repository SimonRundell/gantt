import { describe, expect, it } from 'vitest'
import { MAX_DURATION_DAYS, parseTaskField } from './taskFields.js'

describe('parseTaskField', () => {
  it('accepts a valid start date and rejects an invalid one', () => {
    expect(parseTaskField('start', '2026-10-05')).toEqual({ start: '2026-10-05' })
    expect(parseTaskField('start', '2026-02-30')).toBeNull()
    expect(parseTaskField('start', 'tomorrow')).toBeNull()
  })

  it('rounds and limits a duration to at least 1 working day', () => {
    expect(parseTaskField('durationDays', '4')).toEqual({ durationDays: 4 })
    expect(parseTaskField('durationDays', '2.6')).toEqual({ durationDays: 3 })
    expect(parseTaskField('durationDays', '0')).toEqual({ durationDays: 1 })
    expect(parseTaskField('durationDays', '-5')).toEqual({ durationDays: 1 })
    expect(parseTaskField('durationDays', '999999')).toEqual({ durationDays: MAX_DURATION_DAYS })
  })

  it('keeps percent between 0 and 100', () => {
    expect(parseTaskField('percent', '40')).toEqual({ percent: 40 })
    expect(parseTaskField('percent', '150')).toEqual({ percent: 100 })
    expect(parseTaskField('percent', '-3')).toEqual({ percent: 0 })
  })

  it('ignores empty or non-numeric text', () => {
    expect(parseTaskField('percent', '')).toBeNull()
    expect(parseTaskField('percent', 'abc')).toBeNull()
    expect(parseTaskField('durationDays', '   ')).toBeNull()
  })
})
