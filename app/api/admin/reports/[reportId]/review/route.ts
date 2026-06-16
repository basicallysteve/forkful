import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { deleteReview, getOpenReports } from '@/lib/reviews'
import { taskRunner } from '@/lib/TaskRunner'

type Params = { params: Promise<{ reportId: string }> }

function isAdmin(userId: number): boolean {
  const adminId = process.env.ADMIN_USER_ID
  return adminId !== undefined && userId === Number(adminId)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { reportId } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Resolve the review id from the report, then delete the review (cascades all reports).
  const reports = await getOpenReports()
  const report = reports.find((r) => r.id === Number(reportId))
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await taskRunner.run(() => deleteReview(report.reviewId))
  return new NextResponse(null, { status: 204 })
}
