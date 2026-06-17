import { NextResponse } from 'next/server'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { dismissReport } from '@/lib/reviews'
import { taskRunner } from '@/lib/TaskRunner'

type Params = { params: Promise<{ reportId: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const { reportId } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dismissed = await taskRunner.run(() => dismissReport(Number(reportId)))
  if (!dismissed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
