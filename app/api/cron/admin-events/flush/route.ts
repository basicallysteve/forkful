import { NextResponse } from 'next/server'
import { flushAdminEvents } from '@/lib/adminSignals'
import { captureError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Daily at 07:30 UTC (vercel.json; the Hobby plan only allows daily crons): sends events held back
 * inside the 15-minute window and retries failed sends whose backoff has passed (#416).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { sent } = await flushAdminEvents()
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    captureError(error, { area: 'admin-signals' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
