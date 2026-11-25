import { describe, it, expect } from 'vitest'
import { MAX_ATTEMPTS, outcomeAfterFailure } from '@/lib/adminEventRetry'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-11-25T12:00:00Z')

describe('outcomeAfterFailure', () => {
  it('stays pending and retries after 1 day on the first failure', () => {
    expect(outcomeAfterFailure(0, now)).toEqual({ attempts: 1, status: 'pending', nextAttemptAt: new Date(now.getTime() + DAY) })
  })

  it('backs off to 2 days, then 4 days', () => {
    expect(outcomeAfterFailure(1, now).nextAttemptAt).toEqual(new Date(now.getTime() + 2 * DAY))
    expect(outcomeAfterFailure(2, now).nextAttemptAt).toEqual(new Date(now.getTime() + 4 * DAY))
  })

  it('gives up for good on the fifth failed attempt', () => {
    expect(MAX_ATTEMPTS).toBe(5)
    expect(outcomeAfterFailure(4, now)).toEqual({ attempts: 5, status: 'failed', nextAttemptAt: null })
  })

  it('is still retryable after the fourth failed attempt', () => {
    expect(outcomeAfterFailure(3, now).status).toBe('pending')
  })
})
