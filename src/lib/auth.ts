import 'server-only'
import { auth } from '@/auth'

export type SessionUser = { userId: number; username: string; avatarUrl: string | null; needsOnboarding: boolean }

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return {
    userId: Number(session.user.id),
    username: session.user.name ?? '',
    avatarUrl: session.user.image ?? null,
    needsOnboarding: (session.user as { needsOnboarding?: boolean }).needsOnboarding ?? false,
  }
}
