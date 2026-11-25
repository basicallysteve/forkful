export const MAX_ATTEMPTS = 5

export type EventStatus = 'pending' | 'sent' | 'failed'

export interface FailureOutcome {
  attempts: number
  status: EventStatus
  nextAttemptAt: Date | null
}

/** Stub: the retry policy lands with the implementation commit. */
export function outcomeAfterFailure(attemptsSoFar: number, _now: Date): FailureOutcome {
  return { attempts: attemptsSoFar, status: 'pending', nextAttemptAt: null }
}
