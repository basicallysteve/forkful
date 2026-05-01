import 'server-only'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { eq, isNull, and } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { decrypt } from '@/lib/session'

export const verifySession = cache(async () => {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) return null

  try {
    const payload = await decrypt(sessionCookie) as { userId: number, expiresAt: string }
    return payload
  } catch (error) {
    return null
  }
})

export const getUser = cache(async () => {
  const session = await verifySession()
  if (!session) return null

  const [user] = await db.select().from(users).where(and(eq(users.id, Number(session.userId)), isNull(users.dateDeleted)))
  return user || null
})