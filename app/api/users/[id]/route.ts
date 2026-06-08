import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { updateUserPreferences, updateUserEmail, updateUserPassword } from '@/lib/users'
import { taskRunner } from '@/lib/TaskRunner'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const targetId = Number(id)
  if (isNaN(targetId) || sessionUser.userId !== targetId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (body.action === 'preferences') {
      if (
        !Array.isArray(body.cuisinePreferences) || !Array.isArray(body.dietaryRestrictions) ||
        body.cuisinePreferences.some((v: unknown) => typeof v !== 'string') ||
        body.dietaryRestrictions.some((v: unknown) => typeof v !== 'string')
      ) {
        return NextResponse.json({ error: 'Invalid preferences data' }, { status: 400 })
      }
      await taskRunner.run(() => updateUserPreferences(targetId, {
        cuisinePreferences: body.cuisinePreferences,
        dietaryRestrictions: body.dietaryRestrictions,
      }))
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'email') {
      if (!body.email || !EMAIL_REGEX.test(body.email)) {
        return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
      }
      await taskRunner.run(() => updateUserEmail(targetId, body.email))
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'password') {
      if (!body.currentPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
      }
      if (!body.newPassword || body.newPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }
      await taskRunner.run(() => updateUserPassword(targetId, body.currentPassword, body.newPassword))
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const raw = error instanceof Error ? error.message : ''
    const SAFE_MESSAGES = new Set(['Email already in use', 'Current password is incorrect', 'User not found'])
    const message = SAFE_MESSAGES.has(raw) ? raw : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
