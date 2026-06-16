import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { updateReview, deleteReview } from '@/lib/reviews'
import { taskRunner } from '@/lib/TaskRunner'

type Params = { params: Promise<{ reviewId: string }> }

export async function PUT(request: Request, { params }: Params) {
  const { reviewId } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rating, body: reviewBody } = body

  if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  const updated = await taskRunner.run(() =>
    updateReview(Number(reviewId), session.userId, { rating, body: reviewBody })
  )
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { reviewId } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only the review author can delete their own review via this route.
  // Admin deletion goes through /api/admin/reports/[reportId]/review.
  const deleted = await taskRunner.run(() => deleteReview(Number(reviewId)))
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
