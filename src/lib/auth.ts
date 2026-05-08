import 'server-only'
import { cookies } from 'next/headers'
import { decrypt } from './session'

export type SessionUser = { userId: number; username: string }

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  if (!sessionCookie) return null
  try {
    const payload = await decrypt(sessionCookie) as { userId: string | number; username: string }
    return { userId: Number(payload.userId), username: payload.username }
  } catch {
    return null
  }
}
