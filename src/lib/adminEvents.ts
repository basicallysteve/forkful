import { inArray, isNull, max, sql } from 'drizzle-orm'
import { db } from '@/db'
import { adminEvents } from '@/db/schema'
import type { AdminEventKind, AdminSignalEvent } from '@/lib/adminEventKinds'

export interface ClaimedAdminEvents {
  ids: number[]
  events: AdminSignalEvent[]
  /** When the previous admin email went out (before this claim), or null if none ever did. */
  previousSentAt: Date | null
}

// Arbitrary constant: every claim takes this transaction-scoped lock so two requests can't both
// see "no email in the window" and both send.
const CLAIM_LOCK_KEY = 416_001

export async function addAdminEvent(kind: AdminEventKind): Promise<void> {
  await db.insert(adminEvents).values({ kind })
}

/**
 * Atomically claims every pending event for one email, but only if no admin email went out since
 * `windowStart` (the newest `sent_at` of any event is when the last email went out). Claimed events
 * are stamped sent at once, so a concurrent caller finds them taken and claims nothing. If the send
 * then fails, call `releaseAdminEvents` to make them pending again.
 */
export async function claimDueAdminEvents(windowStart: Date): Promise<ClaimedAdminEvents> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CLAIM_LOCK_KEY}::bigint)`)
    const [last] = await tx.select({ at: max(adminEvents.sentAt) }).from(adminEvents)
    const previousSentAt = last?.at ?? null
    if (previousSentAt && previousSentAt > windowStart) return { ids: [], events: [], previousSentAt: null }

    const claimed = await tx
      .update(adminEvents)
      .set({ sentAt: new Date() })
      .where(isNull(adminEvents.sentAt))
      .returning({ id: adminEvents.id, kind: adminEvents.kind, createdAt: adminEvents.createdAt })
    claimed.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
    return {
      ids: claimed.map((row) => row.id),
      events: claimed.map((row) => ({ kind: row.kind as AdminEventKind, createdAt: row.createdAt })),
      previousSentAt,
    }
  })
}

export async function releaseAdminEvents(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  await db.update(adminEvents).set({ sentAt: null }).where(inArray(adminEvents.id, ids))
}
