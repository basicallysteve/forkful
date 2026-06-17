import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createReviewReport } from '@/lib/reviews'
import { taskRunner } from '@/lib/TaskRunner'
import type { ReviewReportReason } from '@/types/Review'

type Params = { params: Promise<{ reviewId: string }> }

const VALID_REASONS: ReviewReportReason[] = ['spam', 'offensive_language', 'harassment', 'off_topic']

export async function POST(request: Request, { params }: Params) {
  const { reviewId } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { reason, comment } = body

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
  }
  if (comment !== undefined && (typeof comment !== 'string' || comment.length > 500)) {
    return NextResponse.json({ error: 'Comment must be 500 characters or fewer' }, { status: 400 })
  }

  try {
    await taskRunner.run(() =>
      createReviewReport({ userId: session.userId, reviewId: Number(reviewId), reason, comment })
    )
    return NextResponse.json({ reported: true }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit report'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
