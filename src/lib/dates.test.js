import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  calendarDaysBetween,
  compareISODates,
  dayOfWeek,
  formatUKDate,
  isValidISODate,
  maxISODate,
  minISODate,
  parseISODate,
  toISODate,
} from './dates.js'

describe('isValidISODate', () => {
  it('accepts a real calendar date', () => {
    expect(isValidISODate('2026-10-01')).toBe(true)
  })

  it('rejects a date that does not exist', () => {
    expect(isValidISODate('2026-02-30')).toBe(false)
  })

  it('rejects the wrong shape', () => {
    expect(isValidISODate('1/10/2026')).toBe(false)
    expect(isValidISODate('')).toBe(false)
  })
})

describe('parseISODate and toISODate', () => {
  it('round-trips without shifting a day', () => {
    expect(toISODate(parseISODate('2026-12-31'))).toBe('2026-12-31')
  })

  it('reads UTC fields regardless of local time zone', () => {
    const date = parseISODate('2026-01-01')
    expect(date.getUTCFullYear()).toBe(2026)
    expect(date.getUTCMonth()).toBe(0)
    expect(date.getUTCDate()).toBe(1)
  })
})

describe('addCalendarDays', () => {
  it('adds days across a month boundary', () => {
    expect(addCalendarDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('adds days across a year boundary', () => {
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('subtracts with a negative count', () => {
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('handles a leap day correctly', () => {
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('dayOfWeek', () => {
  it('matches a known Thursday', () => {
    // 1 October 2026 is a Thursday.
    expect(dayOfWeek('2026-10-01')).toBe(4)
  })
})

describe('compareISODates, minISODate, maxISODate', () => {
  it('orders dates correctly', () => {
    expect(compareISODates('2026-01-01', '2026-01-02')).toBeLessThan(0)
    expect(compareISODates('2026-01-02', '2026-01-01')).toBeGreaterThan(0)
    expect(compareISODates('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('picks the earlier and later date', () => {
    expect(minISODate('2026-05-01', '2026-04-01')).toBe('2026-04-01')
    expect(maxISODate('2026-05-01', '2026-04-01')).toBe('2026-05-01')
  })
})

describe('calendarDaysBetween', () => {
  it('counts every day, working or not', () => {
    expect(calendarDaysBetween('2026-10-01', '2026-10-05')).toBe(4)
  })

  it('is negative when the second date is earlier', () => {
    expect(calendarDaysBetween('2026-10-05', '2026-10-01')).toBe(-4)
  })

  it('is zero for the same date', () => {
    expect(calendarDaysBetween('2026-10-01', '2026-10-01')).toBe(0)
  })
})

describe('formatUKDate', () => {
  it('formats as dd/mm/yyyy', () => {
    expect(formatUKDate('2026-10-01')).toBe('01/10/2026')
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatUKDate('not-a-date')).toBe('')
  })
})
