export const MAX_ATTEMPTS = 5

const DAY_MS = 24 * 60 * 60 * 1000

export type EventStatus = 'pending' | 'sent' | 'failed'

export interface FailureOutcome {
  attempts: number
  status: EventStatus
  nextAttemptAt: Date | null
}

/**
 * What happens to an event after a failed send: it stays pending and waits 1 day, then 2, 4 and 8
 * before each next try, and after MAX_ATTEMPTS failures it is failed for good.
 * `attemptsSoFar` is the number of failures before this one.
 */
export function outcomeAfterFailure(attemptsSoFar: number, now: Date): FailureOutcome {
  const attempts = attemptsSoFar + 1
  if (attempts >= MAX_ATTEMPTS) return { attempts, status: 'failed', nextAttemptAt: null }
  return { attempts, status: 'pending', nextAttemptAt: new Date(now.getTime() + 2 ** (attempts - 1) * DAY_MS) }
}
