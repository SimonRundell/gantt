import { describe, expect, it } from 'vitest'
import { baselineEnd, baselineVarianceDays, formatVariance } from './baseline.js'
import { DEFAULT_CALENDAR } from './calendar.js'

/**
 * Builds a task with a baseline for the tests.
 * @param {object} overrides - fields to override
 * @returns {object} a task
 */
function task(overrides) {
  return {
    id: 't',
    type: 'task',
    start: '2026-10-05',
    durationDays: 3,
    baseline: { start: '2026-10-05', durationDays: 3 },
    ...overrides,
  }
}

describe('baselineVarianceDays', () => {
  it('is null without a baseline', () => {
    expect(baselineVarianceDays(task({ baseline: null }), DEFAULT_CALENDAR)).toBeNull()
  })

  it('is zero when nothing has moved', () => {
    expect(baselineVarianceDays(task({}), DEFAULT_CALENDAR)).toBe(0)
  })

  it('is positive when the task now finishes later, counting working days', () => {
    // Baseline ends Wed 7th. Now starts Thu 8th and lasts 3 days: ends Mon 12th (Thu, Fri, Mon).
    expect(baselineVarianceDays(task({ start: '2026-10-08' }), DEFAULT_CALENDAR)).toBe(3)
  })

  it('is negative when the task now finishes earlier', () => {
    expect(baselineVarianceDays(task({ durationDays: 1 }), DEFAULT_CALENDAR)).toBe(-2)
  })
})

describe('baselineEnd', () => {
  it('uses the baseline start and duration, not the current ones', () => {
    expect(baselineEnd(task({ start: '2026-11-02' }), DEFAULT_CALENDAR)).toBe('2026-10-07')
  })
})

describe('formatVariance', () => {
  it('formats late, early, on plan and missing', () => {
    expect(formatVariance(3)).toBe('+3d')
    expect(formatVariance(-1)).toBe('-1d')
    expect(formatVariance(0)).toBe('0d')
    expect(formatVariance(null)).toBe('')
  })
})
