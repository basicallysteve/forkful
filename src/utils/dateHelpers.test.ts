import { describe, expect, it } from 'vitest'
import {
  calendarValueToUtcDate,
  formatUtcDateForInput,
  parseInputDateAsUtc,
  utcDateToCalendarValue,
} from './dateHelpers'

describe('UTC date-only helpers', () => {
  it('formats a UTC-midnight timestamp back to its calendar day', () => {
    expect(formatUtcDateForInput(new Date('2026-08-01T00:00:00.000Z'))).toBe('2026-08-01')
  })

  it('round-trips a date-only input through UTC without drifting the day', () => {
    const parsed = parseInputDateAsUtc('2026-08-01')
    expect(parsed.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(formatUtcDateForInput(parsed)).toBe('2026-08-01')
  })

  it('formats by the UTC day even when the local time-of-day is late', () => {
    // 23:30 UTC is still Aug 1 in UTC, so the calendar day must not roll to Aug 2.
    expect(formatUtcDateForInput(new Date('2026-08-01T23:30:00.000Z'))).toBe('2026-08-01')
  })
})

describe('Calendar <-> UTC date-only bridge', () => {
  it('reads a stored UTC-midnight date into a Calendar value on the same calendar day', () => {
    const calendarValue = utcDateToCalendarValue(new Date('2026-08-01T00:00:00.000Z'))
    expect(calendarValue.getFullYear()).toBe(2026)
    expect(calendarValue.getMonth()).toBe(7) // August (0-indexed)
    expect(calendarValue.getDate()).toBe(1)
  })

  it('writes a picked Calendar value back to UTC midnight of that day', () => {
    // A local Date at any time of Aug 1 must persist as 2026-08-01T00:00:00Z.
    expect(calendarValueToUtcDate(new Date(2026, 7, 1, 15, 30)).toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('round-trips a stored date through the Calendar without drifting the day', () => {
    const stored = new Date('2026-08-01T00:00:00.000Z')
    expect(calendarValueToUtcDate(utcDateToCalendarValue(stored)).toISOString()).toBe(stored.toISOString())
  })
})
