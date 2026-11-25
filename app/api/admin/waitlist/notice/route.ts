import { NextResponse } from 'next/server'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { sendWaitlistNotices } from '@/lib/waitlistNotice'
import { captureError } from '@/lib/logger'

export const maxDuration = 60

export async function POST() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    return NextResponse.json(await sendWaitlistNotices(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    captureError(error, { area: 'waitlist' })
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
