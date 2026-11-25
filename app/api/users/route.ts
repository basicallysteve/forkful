import { NextResponse, after } from 'next/server'
import { recordAdminEvent } from '@/lib/adminSignals'
import { getInviteByEmail, signUpWithInvite } from '@/lib/invites'
import { signUp } from '@/lib/users'
import { taskRunner } from '@/lib/TaskRunner'
import { sendUserAccountCreationEmail } from '@/lib/email'
import { captureError } from '@/lib/logger'
import { isInviteOnly } from '@/lib/inviteOnly'
import { isValidWaitlistEmail, normalizeEmail } from '@/lib/waitlist'
import { respondJoinWaitlist } from '@/lib/waitlistResponse'

const INVALID_INVITE = "This invite link isn't valid or has already been used."

type SignUpBody = {
  username?: unknown; password?: unknown
  cuisinePreferences?: string[]; dietaryRestrictions?: string[]; marketingEmailOptIn?: unknown
}

/** The pre-waitlist sign-up (ADR-0032 amended by #374): validate, create the User, tell the admin. */
async function openSignUp(body: SignUpBody, email: string) {
  if (typeof body.username !== 'string' || body.username.trim().length < 3) {
    return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 })
  }
  if (typeof body.password !== 'string' || body.password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  const username = body.username.trim()
  const password = body.password
  try {
    const user = await taskRunner.run(
      () => signUp({
        username,
        email: normalizeEmail(email),
        password,
        cuisinePreferences: body.cuisinePreferences ?? [],
        dietaryRestrictions: body.dietaryRestrictions ?? [],
        marketingEmailOptIn: body.marketingEmailOptIn === true,
      }),
      'user.signup',
    )
    // The "New user signed up" admin email, as before the waitlist; never blocks the sign-up.
    sendUserAccountCreationEmail(username).catch((error) => captureError(error, { area: 'auth' }))
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// ADR-0032: sign-up needs an Invite code. An email without an Invite gets exactly the
// POST /api/waitlist response, decided before the username or password are looked at.
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

  // Open sign-up (flag off, #374): as before the waitlist, no Invite or code is needed.
  if (!(await isInviteOnly())) return openSignUp(body, email)

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
    // Invite accepted: this is the one creation path with a redeemed code, so it happens once per User.
    // After the response; recording never throws and must not slow or fail sign-up.
    after(() => recordAdminEvent('invite-accepted', Number(result.user.id)).catch((error) => captureError(error, { area: 'admin-signals' })))
    return NextResponse.json(result.user, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
