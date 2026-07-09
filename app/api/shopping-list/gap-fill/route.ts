import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { fillPantryGapFromRecipe } from '@/lib/shoppingList'

type GapFillBody = {
  recipeShortId?: string
}

// Amount range errors the data layer may raise once a shortfall is turned into a line; surfaced as a
// client error rather than a 500.
const VALIDATION_ERRORS = ['Amount must be greater than zero', 'Amount is too large']

// Pantry-Gap Fill: add only the ingredients a recipe is short on to the user's active Shopping List.
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: GapFillBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.recipeShortId !== 'string' || body.recipeShortId.trim().length === 0) {
    return NextResponse.json({ error: 'recipeShortId is required' }, { status: 400 })
  }

  try {
    const result = await taskRunner.run(() =>
      fillPantryGapFromRecipe(user.userId, (body.recipeShortId as string).trim())
    )

    if (result === null) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof Error && VALIDATION_ERRORS.includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}
