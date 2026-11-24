import { NextResponse, after } from 'next/server'
import { joinWaitlist, normalizeEmail } from '@/lib/waitlist'
import { sendWaitlistNotificationEmail } from '@/lib/email'
import { captureError } from '@/lib/logger'

type WaitlistRequest = { email: string; name: string | null; marketingEmailOptIn: boolean }

/**
 * The one response for "join the Waitlist". POST /api/waitlist and POST /api/users (for an
 * uninvited email) both return this, so the two are byte-identical and never reveal whether
 * an email is invited, already waitlisted or has an account (ADR-0032).
 */
export async function respondJoinWaitlist(entry: WaitlistRequest): Promise<NextResponse> {
  try {
    const { created } = await joinWaitlist(entry)
    if (created) {
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
