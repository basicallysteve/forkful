import 'server-only'
import { cache } from 'react'
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

// Wrapped in React cache() so the layout and the page share one lookup per server request. The
// memo lives only for that request, so a revoked Invite still applies on the next one.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = Number(session.user.id)
  // Invite-only lock (ADR-0032): a signed-in user without an Invite has no session user, so
  // every API route answers 401 and pages treat them as signed out. Checked on every request.
  if (!(await hasAccess(userId))) return null
  return {
    userId,
    username: session.user.name ?? '',
    avatarUrl: session.user.image ?? null,
    needsOnboarding: (session.user as { needsOnboarding?: boolean }).needsOnboarding ?? false,
    needsPasswordReset: (session.user as { needsPasswordReset?: boolean }).needsPasswordReset ?? false,
  }
})
