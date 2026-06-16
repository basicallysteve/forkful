import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { toggleReviewLike } from '@/lib/reviews'
import { taskRunner } from '@/lib/TaskRunner'

type Params = { params: Promise<{ reviewId: string }> }

export async function POST(_request: Request, { params }: Params) {
  const { reviewId } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await taskRunner.run(() =>
      toggleReviewLike(session.userId, Number(reviewId))
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to toggle like'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
