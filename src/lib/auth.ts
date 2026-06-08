import 'server-only'
import { cookies } from 'next/headers'
import { decrypt } from './session'

export type SessionUser = { userId: number; username: string; avatarUrl: string | null }

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  if (!sessionCookie) return null
  try {
    const payload = await decrypt(sessionCookie) as { userId: string | number; username: string; avatarUrl?: string | null }
    return { userId: Number(payload.userId), username: payload.username, avatarUrl: payload.avatarUrl ?? null }
  } catch (err) {
    console.error('Failed to decrypt session cookie:', err)
    return null
  }
}
