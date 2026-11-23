import { NextResponse } from 'next/server'
import { getRecipes, createRecipe } from '@/lib/recipes'
import { taskRunner } from '@/lib/TaskRunner'
import { getSessionUser } from '@/lib/auth'
import type { Recipe } from '@/types/Recipe'
import type { RecipeQueryOptions } from '@/lib/recipes'
import { parseQueryOptions } from '@/utils/queryParams'
import { isForeignKeyViolation } from '@/utils/dbErrors'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const session = await getSessionUser()
  const filters = parseQueryOptions<RecipeQueryOptions>(searchParams, {
    ingredient: (v) => v ?? undefined,
    published: (v) => v !== null ? v === 'true' : undefined,
    sortBy: (v) => (v as RecipeQueryOptions['sortBy']) ?? undefined,
    sortDir: (v) => (v as RecipeQueryOptions['sortDir']) ?? undefined,
  })
  const recipes = await getRecipes({ ...filters, viewerId: session?.userId })
  return NextResponse.json(recipes)
}

export async function POST(request: Request) {
  const session = await getSessionUser()
  const body: Omit<Recipe, 'id'> = await request.json()
  const recipeData: Omit<Recipe, 'id'> = {
    ...body,
    userId: session ? session.userId : null,
    isPublic: body.isPublic ?? false,
  }
  try {
    const recipe = await taskRunner.run(() => createRecipe(recipeData))
    return NextResponse.json(recipe, { status: 201 })
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: 'One or more ingredients reference a food that does not exist.' }, { status: 400 })
    }
    throw err
  }
}
