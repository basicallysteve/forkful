import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { taskRunner } from '@/lib/TaskRunner'
import { sendWaitlistNoticeEmail } from '@/lib/email'
import { withTimeout } from '@/lib/withTimeout'
import { captureError, logInfo } from '@/lib/logger'

const NOTICE_EMAIL_TIMEOUT_MS = 10_000

/**
 * Sends the one-time waitlist notice (#329) to every Waitlisted User who has not had it yet:
 * an active User, not the admin, whose email has no Invite (ADR-0032). Recipients are claimed
 * with one conditional UPDATE that stamps `waitlist_notice_sent_at`, so a double click or two
 * admins can't notice anyone twice. A failed send releases that User's stamp, so the next
 * click retries only them. Returns how many went out and how many failed.
 */
export async function sendWaitlistNotices(): Promise<{ sent: number; failed: number }> {
  const adminId = process.env.ADMIN_USER_ID
  const claimed = await taskRunner.run(
    () => db
      .update(users)
      .set({ waitlistNoticeSentAt: new Date() })
      .where(and(
        isNull(users.waitlistNoticeSentAt),
        isNull(users.dateDeleted),
        adminId ? ne(users.id, Number(adminId)) : undefined,
        sql`not exists (select 1 from invites i where lower(i.email) = lower(${users.email}))`,
      ))
      .returning({ id: users.id, username: users.username, email: users.email }),
    'waitlist.notice-claim',
  )

  let failed = 0
  for (const user of claimed) {
    try {
      await withTimeout(sendWaitlistNoticeEmail({ to: user.email, username: user.username }), NOTICE_EMAIL_TIMEOUT_MS)
    } catch (error) {
      failed++
      captureError(error, { area: 'waitlist' })
      await taskRunner.run(
        () => db.update(users).set({ waitlistNoticeSentAt: null }).where(eq(users.id, user.id)),
        'waitlist.notice-release',
      )
    }
  }
  const sent = claimed.length - failed
  logInfo('Waitlist notice sent', { area: 'waitlist', sent, failed })
  return { sent, failed }
}
