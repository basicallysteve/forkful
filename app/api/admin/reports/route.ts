import { NextResponse } from 'next/server'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { getOpenReports } from '@/lib/reviews'

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const reports = await getOpenReports()
  return NextResponse.json(reports)
}
