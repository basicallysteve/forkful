import { NextResponse, after } from 'next/server'
import { joinWaitlist, isValidWaitlistEmail, normalizeEmail } from '@/lib/waitlist'
import { sendWaitlistNotificationEmail } from '@/lib/email'
import { captureError } from '@/lib/logger'

export async function POST(request: Request) {
  let body: { email?: unknown; name?: unknown; marketingEmailOptIn?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  }

  if (!isValidWaitlistEmail(body.email)) {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  }

  const entry = {
    email: body.email,
    name: typeof body.name === 'string' ? body.name : null,
    marketingEmailOptIn: body.marketingEmailOptIn === true,
  }

  try {
    const { created } = await joinWaitlist(entry)
    if (created) {
      // after() keeps the function alive until the email is sent, without the visitor's
      // response waiting on (or revealing) it.
      const notification = {
        email: normalizeEmail(entry.email),
        name: entry.name?.trim() || null,
        marketingEmailOptIn: entry.marketingEmailOptIn,
      }
      after(() => sendWaitlistNotificationEmail(notification).catch((error) => captureError(error, { area: 'waitlist' })))
    }
  } catch (error) {
    captureError(error, { area: 'waitlist' })
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  // Identical for a new entry and a duplicate: never reveal whether the email is already known.
  return NextResponse.json({ ok: true })
}
