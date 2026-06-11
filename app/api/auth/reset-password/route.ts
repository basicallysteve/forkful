import { NextResponse } from 'next/server'
import { redeemPasswordResetToken, forceResetPassword } from '@/lib/users'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
  )
}

export async function POST(request: Request) {
  try {
    const body: { token?: string; newPassword?: string } = await request.json()

    if (!body.newPassword || typeof body.newPassword !== 'string' || !isStrongPassword(body.newPassword)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' },
        { status: 400 },
      )
    }

    if (body.token !== undefined) {
      // Token mode: unauthenticated user arriving via email link
      if (typeof body.token !== 'string') {
        return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
      }
      await taskRunner.run(() => redeemPasswordResetToken(body.token!, body.newPassword!))
      return NextResponse.json({ type: 'success' })
    }

    // Forced mode: authenticated user whose password is 90 days old
    const session = await getSessionUser()
    if (!session || !session.needsPasswordReset) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await taskRunner.run(() => forceResetPassword(session.userId, body.newPassword!))
    return NextResponse.json({ type: 'success', passwordChangedAt: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
