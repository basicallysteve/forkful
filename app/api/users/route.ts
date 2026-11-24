import { NextResponse } from 'next/server'
import { getInviteByEmail, signUpWithInvite } from '@/lib/invites'
import { isValidWaitlistEmail } from '@/lib/waitlist'
import { respondJoinWaitlist } from '@/lib/waitlistResponse'

const INVALID_INVITE = "This invite link isn't valid or has already been used."

// Email/password sign-up requires an Invite and its single-use code (ADR-0032). For an email
// without an Invite this answers exactly like POST /api/waitlist and creates no User, and it
// does so before looking at the username or password, so nothing else differs.
export async function POST(request: Request) {
  let body: {
    username?: unknown; email?: unknown; password?: unknown; code?: unknown
    cuisinePreferences?: string[]; dietaryRestrictions?: string[]; marketingEmailOptIn?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  }

  if (!isValidWaitlistEmail(body.email)) {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  }
  const email = body.email

  const invite = await getInviteByEmail(email)
  if (!invite) {
    return respondJoinWaitlist({ email, name: null, marketingEmailOptIn: body.marketingEmailOptIn === true })
  }

  if (typeof body.username !== 'string' || body.username.trim().length < 3) {
    return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 })
  }
  if (typeof body.password !== 'string' || body.password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  try {
    const result = await signUpWithInvite({
      username: body.username.trim(),
      email,
      password: body.password,
      cuisinePreferences: body.cuisinePreferences ?? [],
      dietaryRestrictions: body.dietaryRestrictions ?? [],
      marketingEmailOptIn: body.marketingEmailOptIn === true,
      code: typeof body.code === 'string' ? body.code : undefined,
    })
    if (result.status === 'invalid-code') {
      return NextResponse.json({ error: INVALID_INVITE, code: 'invalid_invite' }, { status: 400 })
    }
    return NextResponse.json(result.user, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
