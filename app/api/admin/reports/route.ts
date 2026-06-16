import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getOpenReports } from '@/lib/reviews'

function isAdmin(userId: number): boolean {
  const adminId = process.env.ADMIN_USER_ID
  return adminId !== undefined && userId === Number(adminId)
}

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const reports = await getOpenReports()
  return NextResponse.json(reports)
}
