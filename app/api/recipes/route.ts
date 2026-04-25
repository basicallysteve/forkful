import { NextResponse } from 'next/server'
import { getRecipes, createRecipe } from '@/lib/recipes'
import { taskRunner } from '@/lib/TaskRunner'
import type { Recipe } from '@/types/Recipe'
import type { RecipeQueryOptions } from '@/lib/recipes'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const options: RecipeQueryOptions = {}
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
  const body: Omit<Recipe, 'id'> = await request.json()
  const recipe = await taskRunner.run(() => createRecipe(body))
  return NextResponse.json(recipe, { status: 201 })
}
