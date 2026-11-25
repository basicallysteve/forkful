import { and, eq, inArray, isNull, lte, max, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { events } from '@/db/schema'
import { ADMIN_EVENT_KINDS, type AdminEventKind, type AdminSignalEvent } from '@/lib/adminEventKinds'
import { outcomeAfterFailure } from '@/lib/adminEventRetry'

export interface ClaimedAdminEvents {
  ids: number[]
  events: AdminSignalEvent[]
}

// Arbitrary constant: every claim takes this transaction-scoped lock so two requests can't both
// see "no email in the window" and both send.
const CLAIM_LOCK_KEY = 416_001

export async function addAdminEvent(type: AdminEventKind, userId?: number): Promise<void> {
  await db.insert(events).values({ type, userId })
}

/**
 * Atomically claims every due event of `types` for one email, but only if no email for those types
 * went out since `windowStart` (the newest `sent_at` is when the last email went out). Due means
 * pending and either never tried or past its `next_attempt_at`. Claimed events are stamped sent at
 * once, so a concurrent caller finds them taken and claims nothing. If the send then fails, call
 * `failAdminEvents`, which clears the stamp again so a failure never counts toward the window.
 */
export async function claimDueAdminEvents(
  windowStart: Date,
  types: readonly string[] = ADMIN_EVENT_KINDS,
  now: Date = new Date(),
): Promise<ClaimedAdminEvents> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CLAIM_LOCK_KEY}::bigint)`)
    const [last] = await tx.select({ at: max(events.sentAt) }).from(events).where(inArray(events.type, [...types]))
    if (last?.at && last.at > windowStart) return { ids: [], events: [] }

    const claimed = await tx
      .update(events)
      .set({ status: 'sent', sentAt: now })
      .where(and(
        inArray(events.type, [...types]),
        eq(events.status, 'pending'),
        or(isNull(events.nextAttemptAt), lte(events.nextAttemptAt, now)),
      ))
      .returning({ id: events.id, type: events.type, createdAt: events.createdAt })
    claimed.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
    return {
      ids: claimed.map((row) => row.id),
      events: claimed.map((row) => ({ kind: row.type as AdminEventKind, createdAt: row.createdAt })),
    }
  })
}

/**
 * Records a failed send for claimed events: one more attempt, the error, and either a retry time
 * (backoff) or, after the last allowed attempt, status failed. Returns the ids that gave up for good.
 */
export async function failAdminEvents(ids: number[], error: string, now: Date = new Date()): Promise<{ terminalIds: number[] }> {
  if (ids.length === 0) return { terminalIds: [] }
  return await db.transaction(async (tx) => {
    const rows = await tx.select({ id: events.id, attempts: events.attempts }).from(events).where(inArray(events.id, ids))
    const terminalIds: number[] = []
    for (const row of rows) {
      const outcome = outcomeAfterFailure(row.attempts, now)
      await tx
        .update(events)
        .set({ attempts: outcome.attempts, status: outcome.status, nextAttemptAt: outcome.nextAttemptAt, lastError: error, sentAt: null })
        .where(eq(events.id, row.id))
      if (outcome.status === 'failed') terminalIds.push(row.id)
    }
    return { terminalIds }
  })
}
