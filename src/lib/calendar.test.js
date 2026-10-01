import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CALENDAR,
  isWorkingDay,
  nextWorkingDay,
  previousWorkingDay,
  shiftByWorkingDays,
  snapForwardToWorkingDay,
  ukBankHolidaysForYear,
  workingDaysBetween,
} from './calendar.js'

// 2026-10-01 is a Thursday, 2026-10-02 Friday, 2026-10-03 Saturday,
// 2026-10-04 Sunday, 2026-10-05 Monday.

describe('isWorkingDay', () => {
  it('treats Monday to Friday as working under the default calendar', () => {
    expect(isWorkingDay('2026-10-01', DEFAULT_CALENDAR)).toBe(true)
    expect(isWorkingDay('2026-10-02', DEFAULT_CALENDAR)).toBe(true)
  })

  it('treats Saturday and Sunday as non-working', () => {
    expect(isWorkingDay('2026-10-03', DEFAULT_CALENDAR)).toBe(false)
    expect(isWorkingDay('2026-10-04', DEFAULT_CALENDAR)).toBe(false)
  })

  it('treats a configured holiday as non-working even on a weekday', () => {
    const calendar = { ...DEFAULT_CALENDAR, nonWorkingDates: ['2026-12-25'] }
    expect(isWorkingDay('2026-12-25', calendar)).toBe(false)
  })
})

describe('snapForwardToWorkingDay', () => {
  it('leaves a working day unchanged', () => {
    expect(snapForwardToWorkingDay('2026-10-01', DEFAULT_CALENDAR)).toBe('2026-10-01')
  })

  it('snaps a Saturday start forward to the following Monday', () => {
    expect(snapForwardToWorkingDay('2026-10-03', DEFAULT_CALENDAR)).toBe('2026-10-05')
  })

  it('snaps forward over a holiday that lands on a weekday', () => {
    const calendar = { ...DEFAULT_CALENDAR, nonWorkingDates: ['2026-12-25', '2026-12-28'] }
    // 2026-12-25 is a Friday holiday; the 26th/27th are the weekend; the
    // 28th is a Monday holiday too, so the next working day is the 29th.
    expect(snapForwardToWorkingDay('2026-12-25', calendar)).toBe('2026-12-29')
  })
})

describe('nextWorkingDay and previousWorkingDay', () => {
  it('skips the weekend forward from a Friday', () => {
    expect(nextWorkingDay('2026-10-02', DEFAULT_CALENDAR)).toBe('2026-10-05')
  })

  it('skips the weekend backward from a Monday', () => {
    expect(previousWorkingDay('2026-10-05', DEFAULT_CALENDAR)).toBe('2026-10-02')
  })
})

describe('shiftByWorkingDays', () => {
  it('moves forward across a weekend', () => {
    // Thursday + 2 working days = Monday (Fri, then Mon).
    expect(shiftByWorkingDays('2026-10-01', 2, DEFAULT_CALENDAR)).toBe('2026-10-05')
  })

  it('moves backward across a weekend', () => {
    expect(shiftByWorkingDays('2026-10-05', -1, DEFAULT_CALENDAR)).toBe('2026-10-02')
  })

  it('returns the snapped day itself when n is zero', () => {
    expect(shiftByWorkingDays('2026-10-03', 0, DEFAULT_CALENDAR)).toBe('2026-10-05')
  })

  it('moves across a configured holiday block', () => {
    // A college closure covering the whole of the week of 21-25 Dec 2026.
    const calendar = {
      ...DEFAULT_CALENDAR,
      nonWorkingDates: ['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25'],
    }
    // Friday 18 Dec + 1 working day should land on Monday 28 Dec, since
    // the whole of the following week is closed.
    expect(shiftByWorkingDays('2026-12-18', 1, calendar)).toBe('2026-12-28')
  })

  it('handles negative lag moving a date earlier by working days', () => {
    expect(shiftByWorkingDays('2026-10-07', -3, DEFAULT_CALENDAR)).toBe('2026-10-02')
  })
})

describe('workingDaysBetween', () => {
  it('is zero for the same date', () => {
    expect(workingDaysBetween('2026-10-01', '2026-10-01', DEFAULT_CALENDAR)).toBe(0)
  })

  it('counts working days across a weekend', () => {
    // Friday and Monday are the two working-day landings between
    // Thursday 10-01 and the following Monday 10-05.
    expect(workingDaysBetween('2026-10-01', '2026-10-05', DEFAULT_CALENDAR)).toBe(2)
  })

  it('is negative when the second date is earlier', () => {
    expect(workingDaysBetween('2026-10-05', '2026-10-01', DEFAULT_CALENDAR)).toBe(-2)
  })

  it('agrees with shiftByWorkingDays as an inverse', () => {
    const start = '2026-10-01'
    const shifted = shiftByWorkingDays(start, 5, DEFAULT_CALENDAR)
    expect(workingDaysBetween(start, shifted, DEFAULT_CALENDAR)).toBe(5)
  })
})

describe('ukBankHolidaysForYear', () => {
  it('returns eight hard-coded holidays for 2026', () => {
    const holidays = ukBankHolidaysForYear(2026)
    expect(holidays).toHaveLength(8)
    expect(holidays).toContain('2026-01-01')
    expect(holidays).toContain('2026-12-25')
  })

  it('returns an empty list for a year with no data', () => {
    expect(ukBankHolidaysForYear(1999)).toEqual([])
  })
})
