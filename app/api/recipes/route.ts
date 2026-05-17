import { NextResponse } from 'next/server'
import { getRecipes, createRecipe } from '@/lib/recipes'
import { taskRunner } from '@/lib/TaskRunner'
import { getSessionUser } from '@/lib/auth'
import type { Recipe } from '@/types/Recipe'
import type { RecipeQueryOptions } from '@/lib/recipes'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const session = await getSessionUser()
  const options: RecipeQueryOptions = {
    viewerId: session?.userId,
  }
  const ingredient = searchParams.get('ingredient')
  const published = searchParams.get('published')
  const sortBy = searchParams.get('sortBy') as RecipeQueryOptions['sortBy']
  const sortDir = searchParams.get('sortDir') as RecipeQueryOptions['sortDir']
  if (ingredient) options.ingredient = ingredient
  if (published !== null) options.published = published === 'true'
  if (sortBy) options.sortBy = sortBy
  if (sortDir) options.sortDir = sortDir
  const recipes = await getRecipes(options)
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
  const recipe = await taskRunner.run(() => createRecipe(recipeData))
  return NextResponse.json(recipe, { status: 201 })
}
