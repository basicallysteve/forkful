import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { invites, users } from '@/db/schema'
import { isInviteOnly } from '@/lib/inviteOnly'

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
 * This is also the one place the `invite-only-access` flag (#374) switches the lock off: with
 * open sign-up everyone is allowed. `request` is for `proxy.ts`, where next/headers is unavailable.
 *
 * Cost: one indexed lookup (users by primary key joined to the unique `lower(invites.email)`
 * index), skipped for the admin.
 */
export async function hasAccess(userId: number, request?: { headers: Headers }): Promise<boolean> {
  if (!(await isInviteOnly(request))) return true
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
 * Where an account exists, use `hasAccess` instead. True for everyone when the `invite-only-access`
 * flag (#374) is off, so OAuth creates the account.
 */
export async function emailHasInvite(email: string, request?: { headers: Headers }): Promise<boolean> {
  if (!(await isInviteOnly(request))) return true
  const rows = await db
    .select({ id: invites.id })
    .from(invites)
    .where(sql`lower(${invites.email}) = lower(${email})`)
    .limit(1)
  return rows.length > 0
}
