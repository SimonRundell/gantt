import { describe, expect, it } from 'vitest'
import { DEFAULT_CALENDAR } from './calendar.js'
import {
  buildHeaderTiers,
  clampPxPerDay,
  computeDateRange,
  dateToX,
  levelForPxPerDay,
  MAX_PX_PER_DAY,
  MIN_PX_PER_DAY,
  pxPerDayFor,
  resolveScale,
  xToDate,
  ZOOM_LEVELS,
  zoomAfterWheel,
} from './timelineScale.js'

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

describe('wheel zoom', () => {
  it('zooms in when rolling away and out when rolling towards you', () => {
    expect(zoomAfterWheel(12, -100)).toBeGreaterThan(12)
    expect(zoomAfterWheel(12, 100)).toBeLessThan(12)
  })

  it('changes by roughly a fifth per ordinary notch, and less for small trackpad steps', () => {
    const notch = zoomAfterWheel(10, -100) / 10
    expect(notch).toBeGreaterThan(1.15)
    expect(notch).toBeLessThan(1.3)
    expect(zoomAfterWheel(10, -4) / 10).toBeLessThan(1.02)
  })

  it('treats line and page delta modes as larger steps', () => {
    expect(zoomAfterWheel(10, -3, 1)).toBeGreaterThan(zoomAfterWheel(10, -3, 0))
  })

  it('stays within the zoom limits', () => {
    expect(zoomAfterWheel(MAX_PX_PER_DAY, -1000)).toBe(MAX_PX_PER_DAY)
    expect(zoomAfterWheel(MIN_PX_PER_DAY, 1000)).toBe(MIN_PX_PER_DAY)
    expect(clampPxPerDay(1000)).toBe(MAX_PX_PER_DAY)
  })
})

describe('levelForPxPerDay and resolveScale', () => {
  it('maps each preset back to its own header style', () => {
    for (const [level, { pxPerDay }] of Object.entries(ZOOM_LEVELS)) {
      expect(levelForPxPerDay(pxPerDay)).toBe(level)
    }
  })

  it('uses the preset zoom unless a free zoom is set', () => {
    expect(resolveScale({ zoom: 'week' })).toEqual({ pxPerDay: 12, level: 'week', custom: false })
    expect(resolveScale({ zoom: 'week', pxPerDay: null }).custom).toBe(false)
    expect(resolveScale({ zoom: 'week', pxPerDay: 6 })).toEqual({ pxPerDay: 6, level: 'month', custom: true })
  })
})
