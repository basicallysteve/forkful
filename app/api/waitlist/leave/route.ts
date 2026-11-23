import { NextResponse } from 'next/server'
import { leaveWaitlist } from '@/lib/waitlist'
import { captureError } from '@/lib/logger'

const INVALID = { error: 'This link is invalid' }

export async function POST(request: Request) {
  let token: unknown
  try {
    token = (await request.json())?.token
  } catch {
    return NextResponse.json(INVALID, { status: 400 })
  }
  if (typeof token !== 'string' || !token) {
    return NextResponse.json(INVALID, { status: 400 })
  }

  try {
    const status = await leaveWaitlist(token)
    if (status === 'invalid') return NextResponse.json(INVALID, { status: 400 })
  } catch (error) {
    captureError(error, { area: 'waitlist' })
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
