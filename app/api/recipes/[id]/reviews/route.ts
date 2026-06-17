import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getReviewsForRecipe, createReview } from '@/lib/reviews'
import { getRecipeByShortId } from '@/lib/recipes'
import { taskRunner } from '@/lib/TaskRunner'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSessionUser()
  const recipe = await getRecipeByShortId(id, session?.userId)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reviews = await getReviewsForRecipe(recipe.id, session?.userId)
  return NextResponse.json(reviews)
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const recipe = await getRecipeByShortId(id, session.userId)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { rating, body: reviewBody } = body

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }
  if (reviewBody !== undefined && (typeof reviewBody !== 'string' || reviewBody.length > 2000)) {
    return NextResponse.json({ error: 'Review body must be 2000 characters or fewer' }, { status: 400 })
  }

  try {
    const review = await taskRunner.run(() =>
      createReview({ userId: session.userId, recipeId: recipe.id, rating, body: reviewBody })
    )
    return NextResponse.json(review, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create review'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
