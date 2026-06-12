import { NextResponse } from 'next/server'
import { processPantryReminders } from '@/lib/emailJobs'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processPantryReminders('daily')
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/pantry-reminders/daily]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
