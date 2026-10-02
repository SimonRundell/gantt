import { describe, expect, it } from 'vitest'
import { expandDateRange, groupIntoRanges, MAX_RANGE_DAYS, mergeDates, removeDateRange } from './calendarEdit.js'

describe('expandDateRange', () => {
  it('lists every day inclusive of both ends', () => {
    expect(expandDateRange('2026-10-26', '2026-10-28')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28'])
  })

  it('returns a single date when the ends match', () => {
    expect(expandDateRange('2026-12-25', '2026-12-25')).toEqual(['2026-12-25'])
  })

  it('crosses month and year boundaries', () => {
    expect(expandDateRange('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('refuses a backwards, invalid or oversized range', () => {
    expect(expandDateRange('2026-10-28', '2026-10-26')).toEqual([])
    expect(expandDateRange('nope', '2026-10-26')).toEqual([])
    expect(expandDateRange('2026-01-01', '2028-01-01').length).toBe(0)
    expect(expandDateRange('2026-01-01', '2026-12-31')).toHaveLength(365)
    expect(MAX_RANGE_DAYS).toBeGreaterThanOrEqual(365)
  })
})

describe('mergeDates', () => {
  it('sorts, removes duplicates and ignores invalid entries', () => {
    expect(mergeDates(['2026-12-25', '2026-01-01'], ['2026-12-25', 'bad', '2026-05-04'])).toEqual([
      '2026-01-01',
      '2026-05-04',
      '2026-12-25',
    ])
  })
})

describe('removeDateRange', () => {
  it('removes only the dates inside the range', () => {
    const dates = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-30']
    expect(removeDateRange(dates, '2026-10-26', '2026-10-27')).toEqual(['2026-10-25', '2026-10-30'])
  })
})

describe('groupIntoRanges', () => {
  it('groups consecutive days and keeps separate days apart', () => {
    const ranges = groupIntoRanges(['2026-10-28', '2026-10-26', '2026-10-27', '2026-12-25'])
    expect(ranges).toEqual([
      { from: '2026-10-26', to: '2026-10-28', days: 3 },
      { from: '2026-12-25', to: '2026-12-25', days: 1 },
    ])
  })

  it('returns nothing for an empty list', () => {
    expect(groupIntoRanges([])).toEqual([])
  })
})
