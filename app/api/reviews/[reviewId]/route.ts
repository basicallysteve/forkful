import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { updateReview, deleteReviewByOwner } from '@/lib/reviews'
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
  if (reviewBody !== undefined && reviewBody !== null && (typeof reviewBody !== 'string' || reviewBody.length > 2000)) {
    return NextResponse.json({ error: 'Review body must be 2000 characters or fewer' }, { status: 400 })
  }

  const updated = await taskRunner.run(() =>
    updateReview({ reviewId: Number(reviewId), userId: session.userId, input: { rating, body: reviewBody } })
  )
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { reviewId } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await taskRunner.run(() => deleteReviewByOwner(Number(reviewId), session.userId))
  if (result === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (result === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return new NextResponse(null, { status: 204 })
}
