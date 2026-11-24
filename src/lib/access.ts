import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { invites, users } from '@/db/schema'

/** True for the admin (`ADMIN_USER_ID`), who always has access. */
function isAdminId(userId: number): boolean {
  const adminId = process.env.ADMIN_USER_ID
  return adminId !== undefined && userId === Number(adminId)
}

/**
 * The single "is this user allowed" check for the invite-only lock (ADR-0032), used by both
 * `proxy.ts` (pages) and `getSessionUser()` (every API route). A user is allowed when they are
 * the admin or their email has an Invite. Nothing is cached, so revoking an Invite locks the
 * user's next request without a re-login.
 *
 * This is also the one place the Vercel flag (#374) will switch the lock off: when open sign-up
 * is enabled, return true here.
 *
 * Cost: one indexed lookup (users by primary key joined to the unique `lower(invites.email)`
 * index), skipped for the admin.
 */
export async function hasAccess(userId: number): Promise<boolean> {
  if (isAdminId(userId)) return true
  const rows = await db
    .select({ id: invites.id })
    .from(users)
    .innerJoin(invites, sql`lower(${invites.email}) = lower(${users.email})`)
    .where(eq(users.id, userId))
    .limit(1)
  return rows.length > 0
}

/**
 * Whether an email has an Invite, for a sign-in that has no `users` row yet (OAuth, #380).
 * Where an account exists, use `hasAccess` instead. When the Vercel flag (#374) turns the lock
 * off, this must return true too.
 */
export async function emailHasInvite(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: invites.id })
    .from(invites)
    .where(sql`lower(${invites.email}) = lower(${email})`)
    .limit(1)
  return rows.length > 0
}
