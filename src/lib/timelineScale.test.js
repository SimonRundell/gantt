import { describe, expect, it } from 'vitest'
import { DEFAULT_CALENDAR } from './calendar.js'
import { buildHeaderTiers, computeDateRange, dateToX, pxPerDayFor, xToDate, ZOOM_LEVELS } from './timelineScale.js'

describe('pxPerDayFor', () => {
  it('returns the configured pixels per day for each zoom level', () => {
    expect(pxPerDayFor('day')).toBe(ZOOM_LEVELS.day.pxPerDay)
    expect(pxPerDayFor('week')).toBe(ZOOM_LEVELS.week.pxPerDay)
    expect(pxPerDayFor('month')).toBe(ZOOM_LEVELS.month.pxPerDay)
    expect(pxPerDayFor('quarter')).toBe(ZOOM_LEVELS.quarter.pxPerDay)
  })

  it('falls back to week for an unknown zoom level', () => {
    expect(pxPerDayFor('decade')).toBe(ZOOM_LEVELS.week.pxPerDay)
  })
})

describe('computeDateRange', () => {
  it('pads a sensible range around today when there are no tasks', () => {
    const { startISO, endISO, totalDays } = computeDateRange([], DEFAULT_CALENDAR)
    expect(startISO < endISO).toBe(true)
    expect(totalDays).toBeGreaterThan(0)
  })

  it('spans from before the earliest task to after the latest task end', () => {
    const tasks = [
      { id: 'a', type: 'task', start: '2026-10-01', durationDays: 2 },
      { id: 'b', type: 'task', start: '2026-11-01', durationDays: 5 },
    ]
    const { startISO, endISO } = computeDateRange(tasks, DEFAULT_CALENDAR)
    expect(startISO < '2026-10-01').toBe(true)
    expect(endISO > '2026-11-01').toBe(true)
  })
})

describe('dateToX and xToDate', () => {
  it('round-trips a date through pixels and back', () => {
    const rangeStart = '2026-10-01'
    const pxPerDay = 12
    const x = dateToX('2026-10-15', rangeStart, pxPerDay)
    expect(xToDate(x, rangeStart, pxPerDay)).toBe('2026-10-15')
  })

  it('places the range start at x = 0', () => {
    expect(dateToX('2026-10-01', '2026-10-01', 12)).toBe(0)
  })
})

describe('buildHeaderTiers', () => {
  it('builds one minor tick per day and a major tick per week-ish month span at day zoom', () => {
    const { minorTicks, majorTicks } = buildHeaderTiers('day', '2026-10-01', '2026-10-08', 1)
    expect(minorTicks).toHaveLength(7)
    expect(minorTicks[0].label).toBe('1')
    expect(majorTicks.length).toBeGreaterThan(0)
  })

  it('builds weekly minor ticks and monthly major ticks at week zoom', () => {
    const { minorTicks, majorTicks } = buildHeaderTiers('week', '2026-10-01', '2026-11-01', 1)
    expect(minorTicks.length).toBeGreaterThan(0)
    expect(majorTicks.some((t) => t.label.startsWith('October'))).toBe(true)
  })

  it('builds monthly minor ticks and yearly major ticks at month zoom', () => {
    const { minorTicks, majorTicks } = buildHeaderTiers('month', '2026-01-01', '2027-02-01', 1)
    expect(minorTicks.some((t) => t.label === 'Oct')).toBe(true)
    expect(majorTicks.map((t) => t.label)).toEqual(['2026', '2027'])
  })

  it('builds quarterly minor ticks at quarter zoom', () => {
    const { minorTicks } = buildHeaderTiers('quarter', '2026-01-01', '2027-01-01', 1)
    expect(minorTicks.map((t) => t.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4'])
  })

  it('keeps tick widths summing to the full range', () => {
    const pxPerDay = pxPerDayFor('week')
    const { majorTicks } = buildHeaderTiers('week', '2026-10-01', '2026-12-01', 1)
    const totalWidth = majorTicks.reduce((sum, t) => sum + t.width, 0)
    const expectedWidth = Math.round((new Date('2026-12-01') - new Date('2026-10-01')) / 86400000) * pxPerDay
    expect(totalWidth).toBe(expectedWidth)
  })
})
