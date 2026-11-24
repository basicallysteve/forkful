import 'server-only'
import { auth } from '@/auth'
import { hasAccess } from '@/lib/access'

export type SessionUser = {
  userId: number
  username: string
  avatarUrl: string | null
  needsOnboarding: boolean
  needsPasswordReset: boolean
}

export function isAdmin(userId: number): boolean {
  const adminId = process.env.ADMIN_USER_ID
  return adminId !== undefined && userId === Number(adminId)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = Number(session.user.id)
  // Invite-only lock (ADR-0032): a signed-in user without an Invite has no session user, so
  // every API route answers 401 and pages treat them as signed out. Checked on every call.
  if (!(await hasAccess(userId))) return null
  return {
    userId,
    username: session.user.name ?? '',
    avatarUrl: session.user.image ?? null,
    needsOnboarding: (session.user as { needsOnboarding?: boolean }).needsOnboarding ?? false,
    needsPasswordReset: (session.user as { needsPasswordReset?: boolean }).needsPasswordReset ?? false,
  }
}
