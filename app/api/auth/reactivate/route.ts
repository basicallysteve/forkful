import { NextResponse } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { reactivateAccount } from '@/lib/users'
import { taskRunner } from '@/lib/TaskRunner'
import bcrypt from 'bcrypt'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.username, username))

    if (!user || !user.password || !user.dateDeleted) {
      return NextResponse.json({ error: 'Account not found or not deactivated' }, { status: 400 })
    }

    // Confirm the deactivated user exists with isNotNull guard (belt-and-suspenders)
    const [deactivated] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.id, user.id))
    if (!deactivated) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 })
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    await taskRunner.run(() => reactivateAccount(user.id))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Reactivation failed' }, { status: 500 })
  }
}
