import { NextResponse } from 'next/server'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { createInvite } from '@/lib/invites'
import { isValidWaitlistEmail } from '@/lib/waitlist'
import { captureError } from '@/lib/logger'

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { entryId?: unknown; email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  let input: Parameters<typeof createInvite>[0]
  if (typeof body.entryId === 'number' && Number.isInteger(body.entryId)) {
    input = { entryId: body.entryId }
  } else if (body.email !== undefined) {
    if (!isValidWaitlistEmail(body.email)) {
      return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
    }
    input = { email: body.email.trim() }
  } else {
    return NextResponse.json({ error: 'Provide an entryId or an email' }, { status: 400 })
  }

  try {
    const result = await createInvite(input)
    if (result.status === 'entry-not-found') return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    if (result.status === 'already-invited') return NextResponse.json({ error: 'Already invited' }, { status: 409 })
    // The raw code is returned exactly once and must never be cached, stored or logged.
    return NextResponse.json(
      { inviteId: result.inviteId, email: result.email, code: result.code },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    captureError(error, { area: 'waitlist' })
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
