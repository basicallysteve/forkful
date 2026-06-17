import 'server-only'
import { auth } from '@/auth'

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
  return {
    userId: Number(session.user.id),
    username: session.user.name ?? '',
    avatarUrl: session.user.image ?? null,
    needsOnboarding: (session.user as { needsOnboarding?: boolean }).needsOnboarding ?? false,
    needsPasswordReset: (session.user as { needsPasswordReset?: boolean }).needsPasswordReset ?? false,
  }
}
