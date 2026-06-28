import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { getIngredientPantryMatches, createPreparedMeal } from '@/lib/pantry'
import type { PreparedMealDeduction } from '@/lib/pantry'

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const recipeShortId = searchParams.get('recipeShortId')
  if (!recipeShortId) return NextResponse.json({ error: 'recipeShortId is required' }, { status: 400 })

  const matches = await getIngredientPantryMatches(recipeShortId, user.userId)
  if (matches === null) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  return NextResponse.json(matches)
}

type PrepareBody = {
  recipeShortId: string
  servings: number
  expirationDate?: string | null
  skipDeduction: boolean
  deductions: PreparedMealDeduction[]
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: PrepareBody = await request.json()

  if (!body.recipeShortId || typeof body.recipeShortId !== 'string') {
    return NextResponse.json({ error: 'recipeShortId is required' }, { status: 400 })
  }
  if (typeof body.servings !== 'number' || body.servings < 1) {
    return NextResponse.json({ error: 'servings must be a positive number' }, { status: 400 })
  }
  if (body.expirationDate && isNaN(new Date(body.expirationDate).getTime())) {
    return NextResponse.json({ error: 'Invalid expirationDate' }, { status: 400 })
  }

  const deductions: PreparedMealDeduction[] = []
  if (!body.skipDeduction && Array.isArray(body.deductions)) {
    for (const d of body.deductions) {
      if (!Number.isInteger(d?.pantryItemId) || d.pantryItemId <= 0) continue
      if (typeof d.amount !== 'number' || isNaN(d.amount) || d.amount <= 0) continue
      deductions.push({ pantryItemId: d.pantryItemId, amount: d.amount })
    }
  }

  try {
    const item = await taskRunner.run(() =>
      createPreparedMeal({
        userId: user.userId,
        recipeShortId: body.recipeShortId,
        servings: body.servings,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        deductions,
      })
    )
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Recipe not found') {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }
    throw err
  }
}
