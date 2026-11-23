import { describe, it, expect } from 'vitest'
import { formatPostDate } from '@/utils/formatPostDate'

describe('formatPostDate', () => {
  it('shows the calendar date as written, with no time-zone shift', () => {
    expect(formatPostDate('2026-06-10')).toBe('June 10, 2026')
    expect(formatPostDate('2026-11-24')).toBe('November 24, 2026')
  })

  it('handles the first and last day of a year', () => {
    expect(formatPostDate('2026-01-01')).toBe('January 1, 2026')
    expect(formatPostDate('2026-12-31')).toBe('December 31, 2026')
  })

  it('returns an empty string for an empty or invalid date', () => {
    expect(formatPostDate('')).toBe('')
    expect(formatPostDate('not-a-date')).toBe('')
  })
})
