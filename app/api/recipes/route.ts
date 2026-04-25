import { NextResponse } from 'next/server'
import { getRecipes, createRecipe } from '@/lib/recipes'
import type { Recipe } from '@/types/Recipe'

export async function GET() {
  const recipes = await getRecipes()
  return NextResponse.json(recipes)
}

export async function POST(request: Request) {
  const body: Omit<Recipe, 'id'> = await request.json()
  const recipe = await createRecipe(body)
  return NextResponse.json(recipe, { status: 201 })
}
