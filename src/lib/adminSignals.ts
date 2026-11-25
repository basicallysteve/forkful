import { taskRunner } from '@/lib/TaskRunner'
import { addAdminEvent, claimDueAdminEvents, failAdminEvents } from '@/lib/adminEvents'
import { MAX_ATTEMPTS } from '@/lib/adminEventRetry'
import type { AdminEventKind } from '@/lib/adminEventKinds'
import { sendAdminSignalEmail } from '@/lib/email'
import { getUser } from '@/lib/users'
import { withTimeout } from '@/lib/withTimeout'
import { captureError, logInfo } from '@/lib/logger'

/** At most one admin email per window. */
export const ADMIN_EMAIL_WINDOW_MS = 15 * 60 * 1000
const SEND_TIMEOUT_MS = 10_000

async function getAdminEmail(): Promise<string | null> {
  const adminId = Number(process.env.ADMIN_USER_ID)
  if (!process.env.ADMIN_USER_ID || !Number.isInteger(adminId)) return null
  return (await getUser(adminId))?.email ?? null
}

/**
 * Claims whatever is pending (only if the window since the last email has ended) and sends it as
 * one email: a lone event as itself, several as a summary. A failed or timed-out send counts an
 * attempt against each event, stores the error and schedules a retry (see `outcomeAfterFailure`),
 * so it never counts toward the window; the next event or the flush cron picks it up once due.
 * A timed-out send may still arrive, so a retry can rarely send a duplicate; that beats losing it.
 */
async function sendDueEvents(to: string): Promise<number> {
  const claim = await taskRunner.run(
    () => claimDueAdminEvents(new Date(Date.now() - ADMIN_EMAIL_WINDOW_MS)),
    'admin-event.claim',
  )
  if (claim.events.length === 0) return 0
  try {
    await withTimeout(sendAdminSignalEmail({ to, events: claim.events }), SEND_TIMEOUT_MS)
  } catch (error) {
    captureError(error, { area: 'admin-signals' })
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500)
    const { terminalIds } = await taskRunner.run(() => failAdminEvents(claim.ids, message), 'admin-event.fail')
    if (terminalIds.length > 0) {
      captureError(new Error(`Admin events gave up after ${MAX_ATTEMPTS} attempts`), { area: 'admin-signals', attributes: { events: terminalIds.length } })
    }
    return 0
  }
  logInfo('Admin signal email sent', { area: 'admin-signals', events: claim.events.length })
  return claim.events.length
}

/**
 * Records that something needs the admin's attention and emails them if no admin email went out
 * in the last 15 minutes; otherwise the event waits for the next event or the flush cron. Never
 * throws: a failure here must not fail the user's request. Does nothing without a valid ADMIN_USER_ID.
 */
export async function recordAdminEvent(kind: AdminEventKind): Promise<void> {
  try {
    const to = await getAdminEmail()
    if (!to) return
    await taskRunner.run(() => addAdminEvent(kind), 'admin-event.record')
    await sendDueEvents(to)
  } catch (error) {
    captureError(error, { area: 'admin-signals' })
  }
}

/** Sends held events once the window has ended (the cron's job). Returns how many events went out. */
export async function flushAdminEvents(): Promise<{ sent: number }> {
  const to = await getAdminEmail()
  if (!to) return { sent: 0 }
  return { sent: await sendDueEvents(to) }
}
