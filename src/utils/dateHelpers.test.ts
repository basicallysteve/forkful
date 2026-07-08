import { describe, expect, it } from 'vitest'
import { formatUtcDateForInput, parseInputDateAsUtc } from './dateHelpers'

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
