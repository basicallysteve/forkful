import { NextResponse } from 'next/server'
import { db } from '@/db'
import { users, login_attempts } from '@/db/schema'
import { eq, and, gte } from 'drizzle-orm'
import { reactivateAccount, trackLoginAttempt } from '@/lib/users'
import { taskRunner } from '@/lib/TaskRunner'
import { getClientIp } from '@/lib/ip'
import bcrypt from 'bcrypt'

export async function POST(request: Request) {
  try {
    const ipAddress = getClientIp(request.headers)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const recentFailed = await db
      .select({ id: login_attempts.id })
      .from(login_attempts)
      .where(and(
        eq(login_attempts.ipAddress, ipAddress),
        eq(login_attempts.successful, 0),
        gte(login_attempts.dateAdded, oneHourAgo),
      ))
    if (recentFailed.length >= 5) {
      return NextResponse.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { username, password } = body

    if (typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.username, username))

    if (!user || !user.password || !user.dateDeleted) {
      await trackLoginAttempt({ ipAddress, successful: false })
      return NextResponse.json({ error: 'Account not found or not deactivated' }, { status: 400 })
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      await trackLoginAttempt({ userId: user.id, ipAddress, successful: false })
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    await taskRunner.run(() => reactivateAccount(user.id))
    await trackLoginAttempt({ userId: user.id, ipAddress, successful: true })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Reactivation failed' }, { status: 500 })
  }
}
