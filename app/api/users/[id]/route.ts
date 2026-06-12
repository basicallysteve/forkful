import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import {
  updateUserPreferences,
  updateUserEmail,
  updateUserPassword,
  updateUsername,
  updateEmailPreferences,
  deactivateAccount,
  deleteAccount,
} from '@/lib/users'
import { taskRunner } from '@/lib/TaskRunner'
import type { RecipeSuggestionFrequency, PantryExpirationFrequency } from '@/types/User'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/
const RECIPE_FREQUENCIES = new Set<string>(['never', 'weekly', 'monthly'])
const PANTRY_FREQUENCIES = new Set<string>(['never', 'daily', 'weekly'])

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

    if (body.action === 'username') {
      if (!body.username || !USERNAME_REGEX.test(body.username)) {
        return NextResponse.json({ error: 'Username must be 3–30 characters, alphanumeric with hyphens and underscores allowed' }, { status: 400 })
      }
      await taskRunner.run(() => updateUsername(targetId, body.username))
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'emailPreferences') {
      if (typeof body.marketingEmailOptIn !== 'boolean') {
        return NextResponse.json({ error: 'Invalid marketingEmailOptIn value' }, { status: 400 })
      }
      if (!RECIPE_FREQUENCIES.has(body.recipeSuggestionFrequency)) {
        return NextResponse.json({ error: 'Invalid recipeSuggestionFrequency value' }, { status: 400 })
      }
      if (!PANTRY_FREQUENCIES.has(body.pantryExpirationFrequency)) {
        return NextResponse.json({ error: 'Invalid pantryExpirationFrequency value' }, { status: 400 })
      }
      await taskRunner.run(() => updateEmailPreferences(targetId, {
        marketingEmailOptIn: body.marketingEmailOptIn,
        recipeSuggestionFrequency: body.recipeSuggestionFrequency as RecipeSuggestionFrequency,
        pantryExpirationFrequency: body.pantryExpirationFrequency as PantryExpirationFrequency,
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

    if (body.action === 'deactivate') {
      await taskRunner.run(() => deactivateAccount(targetId))
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'delete') {
      await taskRunner.run(() => deleteAccount(targetId))
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const raw = error instanceof Error ? error.message : ''
    const SAFE_MESSAGES = new Set([
      'Email already in use',
      'Username already in use',
      'Invalid username format',
      'Current password is incorrect',
      'User not found',
    ])
    const message = SAFE_MESSAGES.has(raw) ? raw : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
