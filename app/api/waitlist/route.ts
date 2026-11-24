import { NextResponse } from 'next/server'
import { isValidWaitlistEmail } from '@/lib/waitlist'
import { respondJoinWaitlist } from '@/lib/waitlistResponse'

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

  return respondJoinWaitlist({
    email: body.email,
    name: typeof body.name === 'string' ? body.name : null,
    marketingEmailOptIn: body.marketingEmailOptIn === true,
  })
}
